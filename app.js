var MongoClient = require('mongodb').MongoClient;
var http = require('http');
var $ = require('cheerio');
var process = require('process');
var later = require('later');

var result = {
    "_id": "",
    "type": "FeatureCollection",
    "features": []
};

var database = "mongodb://localhost:27017/planes";
var collection = "planes";


MongoClient.connect(database, function(err, db) {
    if(err) throw err;
    console.log('connected to db');
    GetFlightData(db);
    setInterval(function () {
      GetFlightData(db);
    }, 15000);

});

function updateNameById(obj, id, value) {
    try  {
        if (obj == null)
            return;
        var done = false;
        obj.some(function (o) {
            if (o.properties != null && o.properties["id"] === id) {
                o = value;
                done = true;

                //  console.log('updating feature');
                return true;
            } else {
                return false;
            }
        });
        if (!done) {
            // console.log('adding feature');
            obj.push(value);
        }
    } catch (e) {
        console.log('error');
    }
}

function CheckFeature(f,db) {
    updateNameById(result.features, f["properties"]["id"], f);

    db.collection(collection).insert(f, function(err, inserted) {      });


}

function GetFlightData(db) {
    var options = {
        host: 'lhr.data.fr24.com',
        path: '/zones/fcgi/feed.js?bounds=55.67283539294783,51.552131597019454,-1.5024902343745907,17.149658203125&faa=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=900&gliders=1&stats=1&'
    };

    var r = "";
    http.request(options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (d) {
            r += d;
        });
        res.on('end', function () {
            result.features.forEach(function (f) {
                f.properties["Active"] = "false";
            });

            var b = JSON.parse(r);
            for (var screen in b) {
                var s = b[screen];
                if (s[1] != null && s[2] != null && s[0] != null) {
                    var sit = {
                        "type": "Feature",
                        "geometry": { "type": "Point", "coordinates": [s[2], s[1]] },
                        "properties": {
                            "id": s[0],
                            "FeatureTypeId": "plane",
                            "Altitude": s[4],
                            "Track": s[3],
                            "Speed": s[5],
                            "Squawk": s[6],
                            "PlaneType": s[8],
                            "Active": "true",
                            "Time": new Date().getTime()
                        }
                    };
                    CheckFeature(sit,db);

                }
            }
            var active = result;
            active.features = active.features.filter(function (f) {
                return f.properties["Active"] == "true";
            });

            console.log(result.features.length);
            // ID to avoid having duplicate _id keys (still need to know why this happens)
            result._id = "Flightradar_" + new Date().getTime();
            //insertIntoDB(result);

        });
    }).end();
}
