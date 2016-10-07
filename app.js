"use strict";

const http = require('http');
const request = require('request');
const express = require('express');
const config = require("config");

const router = express();
const server = http.createServer(router);
const bodyParser = require('body-parser');

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

const Sequelize = require('sequelize');
const LineBotDB = new Sequelize(
  config.sequelize.database, 
  config.sequelize.username, 
  config.sequelize.password,{ logging: console.log }
);

const message_categories = LineBotDB.define('message_categories', 
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

const messages = LineBotDB.define('messages', 
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
    this.events = body.events[0];
    this.message = this.events.message;
    console.log(this.message);
  }
  isText() {
    return this.message.type == 'text';
  }
  getText() {
    return this.message.text;
  }
  getMessage() {
    return this.message;
  }
  isSticker() {
    return this.message.type == 'sticker';
  }
  requestTextMessage(text, callback) {
    const body = {
      'replyToken' : this.events.replyToken,
      'messages' : [
        {
          "type": "text",
          "text": text
        }
      ]
    }
    this.replyMessage(body, callback);
  }
  requestStickerMessage(packageId, stickerId, callback) {
    const body = {
      'replyToken' : this.events.replyToken,
      'messages' : [
        {
          "type": "sticker",
          "packageId": packageId,
          "stickerId": stickerId
        }
      ]
    }
    this.replyMessage(body, callback);
  }
  replyMessage(body, callback) {
    const headers = {
      'Content-Type' : 'application/json; charser=UTF-8',
      'Authorization' : 'Bearer ' + config.line.channel_access_token,
    }
    const options = {
      json: true,
      url: 'https://api.line.me/v2/bot/message/reply',
      headers: headers,
      body: body
    }
    console.log(options.body);
    request.post(options, callback);
  }
}

const getRandomArbitary = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min);
}

router.post('/linebot/callback', function (req, res) {
  res.send('ok');
  const body = req.body;
  const linebotEnd = (error, response, body) => {
    if (!error && response.statusCode == 200) {
      console.log(body);
    } else {
      console.log('error: ' + error + ' ' + JSON.stringify(response));
    }
  };
  const linebot = new LineBot(body);
  // text
  if (linebot.isText()) {
    message_categories.find({where: { keyword : { $like : '%' + linebot.getText() + '%' } } }).done(function(category){
      let category_id = config.default_category_id;
      if (category) {
        category_id = category.id;
      }
      messages.find({where: { category_id: category_id }, order: [ Sequelize.fn( 'RAND' ) ]}).done(function(message){
        linebot.requestTextMessage(message.text, linebotEnd);
      });
    });
  // stamp
  } else if (linebot.isSticker()){
    const stickerId = getRandomArbitary(119, 139);
    linebot.requestStickerMessage('1', stickerId, linebotEnd);
  }
});

server.listen(config.port, process.env.IP || "0.0.0.0", function(){
  console.log("server listen")
});
