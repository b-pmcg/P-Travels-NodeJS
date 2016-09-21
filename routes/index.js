var express = require('express');
var router = express.Router();
var Promise = require("bluebird");
var mongoose = require('mongoose');
var request = require('request');
var fs = require('fs');
const util = require('util');
var _ = require('lodash');
//console.log(util.inspect(MYOBJECT, {showHidden: false, depth: null}))

mongoose.connect('mongodb://127.0.0.1/leaflet_map', function(error) {
    if (error) {
        console.log(error);
    }
});

var Schema = mongoose.Schema;
var JsonSchema = new Schema({
    name: String,
    type: Schema.Types.Mixed
});

var Json = mongoose.model('JString', JsonSchema, 'layercollection');


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'Express'
    });
});

/* GET json data */
router.get('/mapjson/:name', function(req, res) {
    if (req.params.name) {
        Json.findOne({
            name: req.params.name
        }, {}, function(err, docs) {
            res.json(docs);
        });
    }
});

// get layers json data
router.get('/maplayers', function(req, res) {
    Json.find({}, {
        'name': 1
    }, function(err, docs) {
        res.json(docs);
    });
});

//get map page
router.get('/map', function(req, res) {
    Json.find({}, {}, function(e, docs) {
      //console.log(docs.body);
        res.render('map', {
            "jmap": docs,
            lat: 40.78854,
            lng: -73.96374
        });
    });
});

//get json data from phish api names: relax_inn, shootthebreeze
var user = "destiny_unhinged";

router.get('/pnet', function(req, res) {
    request.get({
            url: `https://api.phish.net/api.js?api=2.0&method=pnet.user.myshows.get&format=json&apikey=714E5526D579DF266C5D&username=${user}`
        },
        function(err, response, body) {
          if (err) {
              console.log(err);
          };

          var userShows = JSON.parse(response.body);

          getLatLng(userShows, function(userMapFeatures) {
            res.json(userMapFeatures);
          });
        });
});

router.get('/venues', function(req, res) {
  var country = "USA";
    request.get({
            url: `https://api.phish.net/api.js?api=2.0&method=pnet.shows.query&format=json&apikey=714E5526D579DF266C5D&country=${country}`
        },
        function(err, response, body) {
          if (err) {
              console.log(err);
          };
          //response is an object body is a string
          //console.log(typeof body);
          var userShows = JSON.parse(body);
          console.log(userShows);
          //removes duplicate venue entries and certain properties
          var uniques = _.uniq(userShows, "venue");

          for (var i = 0; i < uniques.length; i++) {
            _.unset(uniques[i], "showid");
            _.unset(uniques[i], "showdate");
            _.unset(uniques[i], "nicedate");
            _.unset(uniques[i], "showyear");
            _.unset(uniques[i], "artist");
            _.unset(uniques[i], "meta");
            _.unset(uniques[i], "relativetime");
            _.unset(uniques[i], "date_month");
            _.unset(uniques[i], "date_day");
            _.unset(uniques[i], "date_dow");
            _.unset(uniques[i], "link");
          }
          //console.log(uniques);
          //writeVenueJSON(uniques);
          // res.send(uniques);
          getLatLngVenues(uniques, function(userMapFeatures) {
            res.send(userMapFeatures);
          });
        });

});

function writeVenueJSON(json) {
  var venueJSON = util.inspect(json, {showHidden: false, depth: null});
  fs.writeFile("public/javascripts/JSON/venues.json", venueJSON, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log("The file was saved!");
  });
}

//helperfunction to create array of location strings for google
function createLocationArray(userShows) {
  var locArr = [];
  for (i = 0; i < userShows.length; i++) {
    locArr.push(`${userShows[i].venuename}, ${userShows[i].city}, ${userShows[i].state}`)
  };
  return locArr;
};

//helperfunction to put features into an array the into the feature object
function addFeatureObjectProperties(userShows) {
  var features = [];
  for (var i = 0; i < userShows.length; i++) {
    var featureObject = {
      "type": "Feature",
      "geometry": {"type": "Point"}
    };
    featureObject.properties = userShows[i];
    features.push(featureObject);
  };
  return features;
};

function addLngLatToVenues(userShows) {

  var featuresArray = addFeatureObjectProperties(userShows);
  var userMapFeatures = {
    "type": "FeatureCollection"
  };
  userMapFeatures.features = featuresArray;

  var coordinatesArr = [];
  var location = createLocationArray(userShows);

  function delayLoop(i) {
    return Promise.delay(1000)
      .then(function() {
        if (i > 0 ) {
          var j = i-1;
          var uri = encodeURI(`maps.googleapis.com/maps/api/geocode/json?address=${location[j]}&key=AIzaSyDMgPjBslgKeL2jO0jxIiaVOKgRCM_TFNk`)
          request.get({
             url: "https://" + uri
           },
           function(status, results) {

            var responseObj = JSON.parse(results.body);


            //console.log(responseObj.results[1]);
            //TODO: figure out why some results are coming undefined.
            //console.log(util.inspect(responseObj, {showHidden: false, depth: null}))
            var lngLat = [parseFloat(responseObj.results[0].geometry.location.lng),parseFloat(responseObj.results[0].geometry.location.lat)];
            var formattedAddress = responseObj.results[0].formatted_address;

            userMapFeatures.features[i].geometry.coordinates = lngLat;
            userMapFeatures.features[i].properties.formatted_address = formattedAddress;
           });
          return delayLoop(i-=1);
        }
        callback(userMapFeatures);
      });
  }
  delayLoop(location.length);
};


//getting venues to put in array

function createLocationArrayVenues(userShows) {
  //console.log(userShows);
  var venueLocArr = [];
  _.forEach(userShows, function(value, key){
    venueLocArr.push(`${value.venue}, ${value.city}, ${value.state}`);
  });
  _.uniq(venueLocArr);
  //console.log(venueLocArr);
  // _.uniq(venueLocArr)
  // console.log(venueLocArr);
  // var locArr = [];
  // for (i = 0; i < userShows.length; i++) {
  //   locArr.push(`${userShows[i].venue}, ${userShows[i].city}, ${userShows[i].state}`)
  // };
  // console.log(locArr);
  // return locArr;
};

function getLatLngVenues(userShows, callback) {
  //console.log(userShows);
  // var featuresArray = addFeatureObjectProperties(userShows);
  // var userMapFeatures = {
  //   "type": "FeatureCollection"
  // };
  // userMapFeatures.features = featuresArray;

  var coordinatesArr = [];
  var location = createLocationArrayVenues(userShows);
  //console.log(location);
  function delayLoop(i) {
    return Promise.delay(1000)
      .then(function() {
        if (i > 0 ) {
          var j = i-1;
          var uri = encodeURI(`maps.googleapis.com/maps/api/geocode/json?address=${location[j]}&key=AIzaSyDMgPjBslgKeL2jO0jxIiaVOKgRCM_TFNk`)
          request.get({
             url: "https://" + uri
           },
           function(status, results) {

            var responseObj = JSON.parse(results.body);


            //console.log(responseObj.results[1]);

            //console.log(util.inspect(responseObj, {showHidden: false, depth: null}))
            var lngLat = [parseFloat(responseObj.results[0].geometry.location.lng),parseFloat(responseObj.results[0].geometry.location.lat)];
            var formattedAddress = responseObj.results[0].formatted_address;

            userShows.features[i].geometry.coordinates = lngLat;
            userShows.features[i].properties.formatted_address = formattedAddress;
           });
          return delayLoop(i-=1);
        }
        callback(userShows);
      });
  }
  delayLoop(location.length);
};

/*myshows method searches venue db for show[i].venuename if found, proceed to map
if not found, check for city, proceed to map
if city not found, check for state, etc.
*/


module.exports = router;
