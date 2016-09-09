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
var LineBotDB = new Sequelize(
  config.sequelize.database, 
  config.sequelize.username, 
  config.sequelize.password,{ logging: console.log }
);

var message_categories = LineBotDB.define('message_categories', 
  {
    id : {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    keyword : {type: Sequelize.STRING,  allowNull: false},
  },
  {
    underscored: true,
    charset: 'utf8',
    timestamps: true,
    paranoid: true
  }
);

var messages = LineBotDB.define('messages', 
  {
    id : {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    category_id : {type: Sequelize.INTEGER, allowNull: false},
    text : {type: Sequelize.STRING,  allowNull: false},
    addition :  {type: Sequelize.TEXT},
  }, 
  {
    underscored: true,
    charset: 'utf8',
    timestamps: true,
    paranoid: true
  }
);

LineBotDB.sync();

class LineBot {
  constructor(body) {
    this.headers = {
      'Content-Type' : 'application/json; charset=UTF-8',
      'X-Line-ChannelID' : config.line.channel_id,
      'X-Line-ChannelSecret' : config.line.channel_secret,
      'X-Line-Trusted-User-With-ACL' : config.line.mid
    };
    this.from = body['result'][0]['content']['from'];
    this.text = body['result'][0]['content']['text'].replace(/\(.*?\)/, '').replace(config.replace_word, '');
  }
  get_text() {
    return this.text;
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
  message_categories.find({where: { keyword : { $like : '%' + linebot.get_text() + '%' } } }).done(function(category){
    let category_id = config.default_category_id;
    if (category) {
      category_id = category.id;
    }
    messages.find({where: { category_id: category_id }, order: [ Sequelize.fn( 'RAND' ) ]}).done(function(message){
      linebot.generate_data(message.text).request(linebot_end);
    });
  });
});

server.listen(config.port, process.env.IP || "0.0.0.0", function(){
  console.log("server listen")
});
