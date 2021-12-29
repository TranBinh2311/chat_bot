require('dotenv').config();
import { set } from "express/lib/application";
import request from "request"
import chatbotService from "../services/ChatbotService";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN
//process.env.NAME_VARIABLE
let getHomePage = (req, res) =>{
    return res.render('homepage.ejs')
}

let postWebhook = (req, res)=>{
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
    
    
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
    
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
}

let getWebhook = (req, res)=>{
     // Your verify token. Should be a random string.
  let VERIFY_TOKEN = process.env.VERIFY_TOKEN
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
}

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;
  
  // Checks if the message contains text
  if (received_message.text) {    
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    response = {
      "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              }
            ],
          }]
        }
      }
    }
  } 
  
  // Send the response message
  callSendAPI(sender_psid, response);    
}

// Handles messaging_postbacks events
async function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;
  
  // Set the response based on the postback payload
  switch(payload){
    case "yes":
      response = { "text": "Thanks!" }
      break;
    case "no":
      response = { "text": "Oops, try sending another image." }
      break;
    case "RESTART_BOT":
    case "GET_STARTED" :
      await chatbotService.handleGetStarted(sender_psid);
      break;
    case "MAIN_PRODUCT":
      await chatbotService.handleSendMainproduct(sender_psid);
      break;
    default:
      response = { "text":`Opp!! I dont know response with your message : ${payload}`}
  }
  // Send the message to acknowledge the postback
  //chatbotService.callSendAPI();
}
// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN  },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}
/*------------------------------------------------------------------------------------------ */

let setUpProfile = async (req, res)=>{
  // call profile facebook profile
  let request_body = {
          "get_started": {"payload":"GET_STARTED"},
           "whitelisted_domains": [
             "https://app-chat-bot-7.herokuapp.com/"
           ]      
  }
  //template string
  // Send the HTTP request to the Messenger Platform
  await request({
    "uri": `https://graph.facebook.com/v12.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    console.log(body);
    if (!err) {
      console.log('Setup Profile Succeeds ');
      
    } else {
      console.error("Unable to Setup:" + err);
    }
  }); 
  return res.send("Setup Profile Succeeds")
}

let setUpPersistentMenu =  async (req, res) =>{
// call profile facebook profile
    let request_body = {
        "persistent_menu": [
          {
              "locale": "default",
              "composer_input_disabled": false,
              "call_to_actions": [
                  {
                      "type": "web_url",
                      "title": "Facebook của ông chủ",
                      "url": "https://www.facebook.com/profile.php?id=100015374085386",
                      "webview_height_ratio": "full"
                  },
                  {
                      "type": "web_url",
                      "title": "Facebook của page",
                      "url": "https://www.facebook.com/Robert-104556582086483",
                      "webview_height_ratio": "full"
                  },
                  {
                      "type": "postback",
                      "title": "Chào lại",
                      "payload": "RESTART_BOT",   
                  }
              ]
          }
      ]
    }
    //template string
    // Send the HTTP request to the Messenger Platform
    await request({
    "uri": `https://graph.facebook.com/v12.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
    }, (err, res, body) => {
    console.log(body);
    if (!err) {
    console.log('Setup persistent Succeeds ');

    } else {
    console.error("Unable to Setup:" + err);
    }
    }); 
    return res.send("Setup persistent Succeeds ")
}
module.exports = {
    getHomePage: getHomePage,
    postWebhook:  postWebhook,
    getWebhook: getWebhook,
    setUpProfile: setUpProfile,
    setUpPersistentMenu: setUpPersistentMenu
}