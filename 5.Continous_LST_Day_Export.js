
var coleccion_imagenes=require('users/corfobbppciren2023/Humedad_de_Suelo:1.coleccion_imagenes.js');
var table = coleccion_imagenes.tabla;
var CFSv2_day=require('users/corfobbppciren2023/LST:1.CFSv2_TFA_Day.js');
var MODIS_day=require('users/corfobbppciren2023/LST:3.MODIS_TFA_Day.js');
var firstYear=require('users/corfobbppciren2023/firstYear:0.firstYear.js');

var MODIS_TFA = ee.Image(MODIS_day.TFA_Images),
    CFSV2_TFA = ee.Image(CFSv2_day.TFA_Images);
    
var firstYear_ = ee.String(ee.Number(firstYear.firstYear));

var firstYearplusone_ = ee.String(ee.Number(firstYear.firstYear).add(1));

var firstDay = firstYear_.cat('-01-01');
var lastDay  = firstYearplusone_.cat('-01-01');
var Assets_path = 'users/corfobbppciren2023/Humedad_de_Suelo_Auxiliares/';
var Temperature_Band = 'Maximum_temperature_height_above_ground_6_Hour_Interval';
var collection = 'NOAA/CFSV2/FOR6H';
var start_hour = '12';

var MODIS_TFA_ic = ee.ImageCollection(MODIS_TFA.bandNames().map(function(name) { 
  return MODIS_TFA.select([ee.Algorithms.String(name)],['mod']).set('system:DOY', ee.Number.parse(ee.Algorithms.String(name).replace('TFA','0').replace('_','')).add(1)) }));
var CFSV2_TFA_ic = ee.ImageCollection(CFSV2_TFA.bandNames().map(function(name) { 
  return CFSV2_TFA.select([ee.Algorithms.String(name)],['cfs']).set('system:DOY', ee.Number.parse(ee.Algorithms.String(name).replace('TFA','0').replace('_','')).add(1)) }));

var geometry = table; //Valparaiso
var geometria=geometry;

var modisProjection = MODIS_TFA.projection().crs().getInfo();
var scale = ee.Image(MODIS_TFA).projection().nominalScale().getInfo();
var escala=scale;

// Get the CFSv2 data at MODIS scale and projection.
var resample = function(image) {
  return image.resample('bilinear')
              .reproject({
                    crs: modisProjection,
                    scale: scale})
              .set('system:DOY', image.get('system:DOY'))
              .set('system:time_start', image.get('system:time_start'));
};

//convert Kelvin to Celsius
var k2celsius = function(image) {
      return image.subtract(ee.Image(273.15))
                  .clip(geometry)
                  .set('system:time_start', image.get('system:time_start'));
};

// Add a property with doy to the colection.
function createDoyBand(img) {
  var d = ee.Date(img.get('system:time_start'))
    .getRelative('day', 'year')
    .add(1);
  img=img.set('system:DOY', d);
  return img;
}

// Construct image date from 'system:index' and add it to a new 'date' property 
var addTimeStampToCFSv2 = function(image) {
   var start = ee.String(image.get('system:index'));
   var y = start.slice(0,4);
   var m = start.slice(4,6);
   var d = start.slice(6,8);
   var date = y.cat('-').cat(m).cat('-').cat(d);
   return image.set({'system:time_start': date});
};
// Construct image date from 'system:index' and add it to a new 'date' property 
var addTimeStampToMODIS = function(image) {
   var start = ee.String(image.get('system:index'));
  // var date = start.replace(/_/g, '-');
   start = start.replace('_', '-');
   var date = start.replace('_', '-');
   return image.set({'system:time_start': ee.String(date)});
};

CFSV2_TFA_ic = CFSV2_TFA_ic.map(resample);

var CFSV2 = ee.ImageCollection(collection)
            .filterDate(firstDay, lastDay)
            .filter(ee.Filter.stringEndsWith('system:index', start_hour))
            .map(resample)
            .select(Temperature_Band)
            .map(k2celsius)
            .map(createDoyBand);
            

// Use an equals filter to specify how the collections match.
var Filter = ee.Filter.equals({
  leftField: 'system:DOY',
  rightField: 'system:DOY'
});
  // Define the join.
  var innerJoin = ee.Join.inner('primary', 'secondary');

// Join CFSV2 with CFSV2_TFA_ic by DOY
  // Apply the join.
  var CFSV2_JoinInner = innerJoin.apply(CFSV2, CFSV2_TFA_ic, Filter);
  
// Calculate CFSv2 anomalies
var CFSV2_Anomalies = CFSV2_JoinInner.map(function(f) {
  var tfa = ee.Image(f.get('secondary'));
  var actual = ee.Image(f.get('primary'));
  return actual.subtract(tfa);
}).map(addTimeStampToCFSv2)
               .map(createDoyBand);
               

// Join MODIS_TFA_ic with CFSV2_Anomalies by DOY
  // Apply the join.
  var MODIS_JoinInner = innerJoin.apply(CFSV2_Anomalies, MODIS_TFA_ic, Filter);

// Calculate MODIS TFA Plus CFSv2 anomalies
var MODIS_Continuous = MODIS_JoinInner.map(function(f) {
  var anomalies       = ee.Image(f.get('primary'));
  var tfa = ee.Image(f.get('secondary'));
  return anomalies.add(tfa);//.subtract(anomalies);
}).map(addTimeStampToCFSv2)
               .map(createDoyBand);
               
var Temperature_Band = 'LST_Day_1km';
var collection = 'MODIS/061/MOD11A1';
//convert Kelvin to Celsius
var modis_k2celsius = function(image) {
      return image.multiply(ee.Image(0.02))
                  .subtract(ee.Image(273.15))
                  .clip(geometry)
                  .set('system:time_start', image.get('system:time_start'))
//                  .rename([ee.String('day_').cat(image.get('system:time_start'))]);
                  .rename([ee.String('DayLSTcont_').cat(image.get('system:time_start'))]);
};

var MODIS_LST = ee.ImageCollection(collection)
            .filterDate(firstDay, lastDay)
            .select(Temperature_Band)
            .map(addTimeStampToMODIS)
            .map(modis_k2celsius);

var MODIS_LST_image = MODIS_LST.toBands();
var MODIS_LST_bandNAmes=MODIS_LST_image.bandNames().slice(-10);

// Use an equals filter to specify how the collections match.
Filter = ee.Filter.equals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'
});

// Join MODIS_LST with MODIS_TFA_plus_CFSV2_Anomalies by DOY
  // Apply the join.
  var MODIS_Blended_JoinInner = innerJoin.apply(MODIS_Continuous,MODIS_LST, Filter);
// Blend the results to fill LST gaps
var MODIS_LST_Blended = MODIS_Blended_JoinInner.map(function(f) {
  var prediction = ee.Image(f.get('secondary'));
  var lst = ee.Image(f.get('primary'));
  return prediction.blend(lst);
});

//Iterating over the image collection using this function....
var LST_Images = MODIS_LST_Blended//.select(Temperature_Band)
  .iterate(function(img, all) {
      return ee.Image(all).addBands(img);
  }, ee.Image().select());
  
var LST_ic = ee.ImageCollection(ee.Image(LST_Images).bandNames().map(function(name) { 
  return ee.Image(LST_Images).select([ee.Algorithms.String(name)]).set('system:index', name) }));

var scale = ee.Image(MODIS_LST_Blended.first()).select([0]).projection().nominalScale().getInfo();
var LST_ic = LST_ic.toBands();
var bandNames=LST_ic.bandNames();

var bandNames2=bandNames;
var index=ee.List.sequence(0, 352)
    bandNames2=index.map(function(i){
      i=ee.Number(i);
      return bandNames2.set(i,ee.String(bandNames2.get(i)).slice(0,21)).get(i)});

LST_ic=LST_ic.select(bandNames).rename(bandNames2);

exports.LST_ic = LST_ic;
exports.geometria = geometria;
exports.escala = escala;

