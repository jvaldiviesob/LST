// This code uses Temporal Fourier Analysis to build 365 images, for each day of year, 
// of the climatological tempratures based on the day (or night) temperatures.

var coleccion_imagenes=require('users/corfobbppciren2023/Humedad_de_Suelo:1.coleccion_imagenes.js');

var table = coleccion_imagenes.tabla;

// Choose here either day or night
//var start_hour = '00'
var start_hour = '12'

// Insert here the coordinates of the area of interest.
var geometry = table; //Valparaiso

// Insert here the coordinates of the area of interest.
var geometria = table; //Valparaíso

// Change the path to your own assets folder
var Assets_path = 'users/corfobbppciren2023/CFSv2_TFA_Day_Valparaiso';

var Temperature_Band = 'Maximum_temperature_height_above_ground_6_Hour_Interval';
var collection = 'NOAA/CFSV2/FOR6H';
// The number of cycles per year to model.
var harmonics = 3;

// Make a list of harmonic frequencies to model.  
// These also serve as band name suffixes.
var harmonicFrequencies = ee.List.sequence(1, harmonics);
// Function to get a sequence of band names for harmonic terms.
var getNames = function(base, list) {
  return ee.List(list).map(function(i) { 
    return ee.String(base).cat(ee.Number(i).int());
  });
};

// Construct lists of names for the harmonic terms.
var cosNames = getNames('cos_', harmonicFrequencies);
var sinNames = getNames('sin_', harmonicFrequencies);

var k2celsius = function(image) {
      return image.subtract(ee.Image(273.15))   //convert Kelvin to Celsius
                  .set('system:time_start', image.get('system:time_start'));
};



// Function to compute the specified number of harmonics
// and add them as bands. 
    // for p = 0, Nharmonics-1 do begin
    //   a[p] = a[p] + 2*TS_t*cos(2*!pi*(p+1)*(t+1)/N)
    //   b[p] = b[p] + 2*TS_t*sin(2*!pi*(p+1)*(t+1)/N)
var addHarmonics = function(freqs) {
  return function(image) {
    // Make an image of frequencies.
    var frequencies = ee.Image.constant(freqs);
    // This band should represent lst.
    var lst = ee.Image(image).select(Temperature_Band);
    // This band should represent days from start.
    var time = ee.Image(image).select('t');
    // Get the cosine terms.
    var cosines = lst.multiply(2.0).multiply((frequencies.multiply(2.0 * Math.PI).multiply(time).divide(365.0)).cos())
      .rename(cosNames);
    // Get the sin terms.
    var sines = lst.multiply(2.0).multiply((frequencies.multiply(2.0 * Math.PI).multiply(time).divide(365.0)).sin())
      .rename(sinNames);
    return image.addBands(cosines).addBands(sines);
  };
};



var LST = ee.ImageCollection(ee.List.sequence(1, 365).map(function (doy){
  return  ee.ImageCollection(collection)
                        .select(Temperature_Band)
                        .filter(ee.Filter.calendarRange(doy, doy, 'day_of_year'))
                        .filter(ee.Filter.stringEndsWith('system:index', start_hour))
                        .map(k2celsius)
                        .mean()
                        .set({doy: doy})
                        .addBands(ee.Image(ee.Number(doy)).rename('t'))
                        // .map(addHarmonics(harmonicFrequencies));
}))



LST = LST.map(addHarmonics(harmonicFrequencies));

  // a = a / N_TS
  // b = b / N_TS
var num_days = 365;//ee.Date(lastDay).difference(ee.Date(firstDay), 'day');
var a_coef_1 = LST.select('cos_1').sum().divide(num_days);
var a_coef_2 = LST.select('cos_2').sum().divide(num_days);
var a_coef_3 = LST.select('cos_3').sum().divide(num_days);
var b_coef_1 = LST.select('sin_1').sum().divide(num_days);
var b_coef_2 = LST.select('sin_2').sum().divide(num_days);
var b_coef_3 = LST.select('sin_3').sum().divide(num_days);

  // ; ========================================
  // ; prepare the first 3 harmonics of the TFA
  // ; ========================================
  // H0        = total(TS) / N_TS                                ;mean
  // FTA       = MAKE_ARRAY(N_TS, /FLOAT, VALUE=0.)
  // H         = MAKE_ARRAY(Nharmonics, N_TS, /FLOAT, VALUE=0.)
  // omega     = MAKE_ARRAY(Nharmonics, /FLOAT, VALUE=0.)
  // Phase     = MAKE_ARRAY(Nharmonics, /FLOAT, VALUE=0.)
  // Amplitude = MAKE_ARRAY(Nharmonics, /FLOAT, VALUE=0.)
  // for p = 0, Nharmonics-1 do begin
  //   omega[p]     = 2. * !pi * (p+1) / N
  //   Phase[p]     = atan( -b[p], a[p] )
  //   Amplitude[p] = sqrt( a[p]^2 + b[p]^2 )

var H0 = LST.select(Temperature_Band).mean();
    // Get the omega terms.
var omega_1 = ee.Image(1.0).multiply(2.0 * Math.PI).divide(365.0);
var omega_2 = ee.Image(2.0).multiply(2.0 * Math.PI).divide(365.0);
var omega_3 = ee.Image(3.0).multiply(2.0 * Math.PI).divide(365.0);

var phase_1 = a_coef_1.atan2(b_coef_1.multiply(ee.Image(-1.0)));
var phase_2 = a_coef_2.atan2(b_coef_2.multiply(ee.Image(-1.0)));
var phase_3 = a_coef_3.atan2(b_coef_3.multiply(ee.Image(-1.0)));

var amplitude_1 = (a_coef_1.pow(2).add(b_coef_1.pow(2))).sqrt();
var amplitude_2 = (a_coef_2.pow(2).add(b_coef_2.pow(2))).sqrt();
var amplitude_3 = (a_coef_3.pow(2).add(b_coef_3.pow(2))).sqrt();

  //   for t = 0, N_TS-1 do begin
  //     H[p,t] = Amplitude[p] * cos(omega[p]*(t+1) + Phase[p])    
  
// Function to add a H band.
var addH = function(image) {
  var H_1 = amplitude_1.multiply((omega_1.multiply(image.select('t')).add(phase_1)).cos()).rename('H_1');
  var H_2 = amplitude_2.multiply((omega_2.multiply(image.select('t')).add(phase_2)).cos()).rename('H_2');
  var H_3 = amplitude_3.multiply((omega_3.multiply(image.select('t')).add(phase_3)).cos()).rename('H_3');
  // FTA[t] = H0 + H[0,t] + H[1,t] + H[2,t]
  var TFA = H0.add(H_1).add(H_2).add(H_3).rename('TFA');

  var Anomalies = TFA.subtract(image.select(Temperature_Band)).rename('Anomalies');
  return image.addBands(TFA).addBands(Anomalies);
};

var LST_TFA = LST.map(addH);

// Define the visualization parameters.
var vizParams = {
  bands: ['mean', 'phase', 'amplitude'],
  min:   [285.0,2.0,5.0],
  max:   [295.0,3.0,10.0],
  gamma: [1.0, 1.0, 1.0]
};

//display the image.
var img = ee.Image(H0.addBands(phase_1).addBands(amplitude_1).rename('mean', 'phase', 'amplitude'));
// Map.addLayer(img, vizParams, 'RGB');
            
// var modelTFA = LST_TFA.select(['TFA', Temperature_Band, 'Anomalies']);
// var modisTFA = LST_TFA.select(['TFA', Temperature_Band]);

// print(LST_TFA)
//Iterating over the image collection using this function....
var TFA_Images = LST_TFA.select('TFA')
  .sort('t')
  .iterate(function(img, all) {
      return ee.Image(all).addBands(img);
  }, ee.Image().select());


exports.TFA_Images = TFA_Images;
exports.Assets_path = Assets_path;
exports.start_hour = start_hour;
exports.geometria = geometria;


