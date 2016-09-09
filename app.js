"use strict";

var http = require('http');
var request = require('request');
var express = require('express');
var config = require("config");

var router = express();
var server = http.createServer(router);
var bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({extended: true}));  
router.use(bodyParser.json());                        
router.enable('trust proxy');
router.get('/', function (req, res) {
  console.log("hello world")
  res.send('Hello world');
});

router.get('/linebot/callback', function (req, res) {
  console.log("hello world")
  res.send('Hello world');
});

var Sequelize = require('sequelize');
var Restaurant = new Sequelize(
  config.sequelize.database, 
  config.sequelize.username, 
  config.sequelize.password,{ logging: console.log }
);

var restaurants = Restaurant.define('restaurants', 
  {
    id    : {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    name  : {type: Sequelize.STRING,  allowNull:false},
    url   : {type: Sequelize.STRING,  allowNull:false},
  },
  {
    underscored: true,
    charset: 'utf8',
    timestamps: true,
    paranoid: true,
    classMethods: {
      get_random: function(callback){
        var sql = "SELECT * FROM restaurants GROUP BY id ORDER BY RAND()";
        Restaurant.query(sql, this).done(callback);
      }
    }
  }
);

Restaurant.sync();

class LineBot {
  constructor(body) {
    this.headers = {
      'Content-Type' : 'application/json; charset=UTF-8',
      'X-Line-ChannelID' : config.line.channel_id,
      'X-Line-ChannelSecret' : config.line.channel_secret,
      'X-Line-Trusted-User-With-ACL' : config.line.mid
    };
    this.from = body['result'][0]['content']['from']
    this.text = body['result'][0]['content']['text'];
  }
  is_restaurant() {
    return this.text.match(/何食べる？/);
  }
  generate_data(text) {
    this.data = {
      'to': [ this.from ],
      'toChannel': 1383378250,
      'eventType':'140177271400161403',
      "content": {
        "messageNotified": 0,
        "messages": [
          {
            "contentType": 1,
            "text": text
          }
        ]
      }
    }
    return this;
  }
  generate_restaurant_data(item) {
    this.generate_data(item.name + "\n" + item.url)
    return this;
  }
  request(callback) {
    const options = {
      url: 'https://trialbot-api.line.me/v1/events',
      headers: this.headers,
      json: true,
      body: this.data
    };
    request.post(options, callback);
  }
}

router.post('/linebot/callback', function (req, res) {
  res.send('ok');

  const body = req.body;
  var linebot_end = function(error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log(body);
    } else {
      console.log('error: '+ JSON.stringify(response));
    }
  };
  const linebot = new LineBot(body);
  if (linebot.is_restaurant()) {
    restaurants.find({order: [ Sequelize.fn( 'RAND' ) ]}).done(function(item){
      linebot.generate_restaurant_data(item).request(linebot_end);
    })
  } else {
    linebot.generate_data("ふむふむ").request(linebot_end);
  }
});

server.listen(config.port, process.env.IP || "0.0.0.0", function(){
  console.log("server listen")
});
