//Script para LST Continuous

var Continous_LST_Day = require('users/corfobbppciren2023/LST:5.Continous_LST_Day_Export.js'),
    Continous_LST_Night = require('users/corfobbppciren2023/LST:6.Continous_LST_Night_Export.js'),
    firstYear = require('users/corfobbppciren2023/firstYear:0.firstYear.js');

var firstYear = firstYear.firstYear;

//exports.Continous_LST_Day = Continous_LST_Day;
//exports.Continous_LST_Night = Continous_LST_Night;

Export.image.toAsset({
  image: ee.Image(Continous_LST_Day.LST_ic),
  assetId: 'LST_Day_Valparaiso_'+firstYear,
  description: 'LST_Day_Valparaiso_'+firstYear,
  scale: 1000,
  region: Continous_LST_Day.geometria,
  crs: "EPSG:4326",
});

Export.image.toAsset({
  image: ee.Image(Continous_LST_Night.LST_ic),
  assetId: 'LST_Night_Valparaiso_'+firstYear,
  description: 'LST_Night_Valparaiso_'+firstYear,
  scale: 1000,
  region: Continous_LST_Night.geometria,
  crs: "EPSG:4326",
});
