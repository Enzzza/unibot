/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const
    bodyParser = require('body-parser'),
    config = require('config'),
    crypto = require('crypto'),
    express = require('express'),
    https = require('https'),
    request = require('request'),
    requestPromise = require('request-promise'),
    client = require('redis').createClient(process.env.REDIS_URL),
    axios = require('axios'),
    unirest = require('unirest'),
    getWeatherInfo = require('./weather'),
    {
        Pool,
        Client

    } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: true,

    });

const jokeOptions = {
  url: 'https://icanhazdadjoke.com/',
  headers: {
    'Accept': 'application/json'
  },
  json:true
};
//Zamato API
/*var ZomatoAPI = require('node-zomato');

var foodApi = new ZomatoAPI(process.env.ZOMATO_KEY);

foodApi.verify(function(isVerified) {
    console.log("Food api :"+isVerified);
    if (isVerified === false) {
        process.exit();
    }
});


foodApi.getGeoCode(52.520008,13.404954,function(error,response){
    if(error){
        console.log(error);
    }
    else{
        console.log(JSON.parse(response.body));
    }

});*/

//
//Dialogflow
const projectId = 'unibot-469ba';
const sessionId = '123456';
const languageCode = 'en-US';
const dialogflow = require('dialogflow');
const dialogFlowConfig = {
      credentials: {
        private_key: JSON.parse(process.env.DIALOGFLOW_PRIVATE_KEY),
        client_email: process.env.DIALOGFLOW_CLIENT_EMAIL
      }
    };
const sessionClient = new dialogflow.SessionsClient(dialogFlowConfig);
const sessionPath = sessionClient.sessionPath(projectId, sessionId);
//End of Dialogflow

//This will make heroku be awake...

setInterval(function(){
https.get("https://unibot-app.herokuapp.com/");

console.log("Pinging heroku site!");


},150000);



//

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({
    verify: verifyRequestSignature
}));
app.use(express.static('public'));

/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = process.env.app_secret;

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.validation_token;

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.page_access_token;

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = process.env.server_url;

const API_URL = process.env.api_url;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
    console.error("Missing config values");
    process.exit(1);
}

/*
* Setting redis vars
*
*
*
client.hmset('state', {
    'payload': '',
    'message': '',
    'top': ''
});




/*
*End of redis vars
*
*/
/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function(req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function(pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;

            // Iterate over each messaging event
            pageEntry.messaging.forEach(function(messagingEvent) {
                if (messagingEvent.optin) {
                    receivedAuthentication(messagingEvent);
                } else if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else if (messagingEvent.delivery) {
                    receivedDeliveryConfirmation(messagingEvent);
                } else if (messagingEvent.postback) {
                    receivedPostback(messagingEvent);
                } else if (messagingEvent.read) {
                    receivedMessageRead(messagingEvent);
                } else if (messagingEvent.account_linking) {
                    receivedAccountLink(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've 
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
app.get('/authorize', function(req, res) {
    var accountLinkingToken = req.query.account_linking_token;
    var redirectURI = req.query.redirect_uri;

    // Authorization Code should be generated per user by the developer. This will 
    // be passed to the Account Linking callback.
    var authCode = "1234567890";

    // Redirect users to this URI on successful login
    var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

    res.render('authorize', {
        accountLinkingToken: accountLinkingToken,
        redirectURI: redirectURI,
        redirectURISuccess: redirectURISuccess
    });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    var signature = req.headers["x-hub-signature"];

    if (!signature) {
        // For testing, let's log an error. In production, you should throw an 
        // error.
        console.error("Couldn't validate the signature.");
    } else {
        var elements = signature.split('=');
        var method = elements[0];
        var signatureHash = elements[1];

        var expectedHash = crypto.createHmac('sha1', APP_SECRET)
            .update(buf)
            .digest('hex');

        if (signatureHash != expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the '-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfAuth = event.timestamp;

    // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
    // The developer can set this to an arbitrary value to associate the 
    // authentication callback with the 'Send to Messenger' click event. This is
    // a way to do account linking when the user clicks the 'Send to Messenger' 
    // plugin.
    var passThroughParam = event.optin.ref;

    console.log("Received authentication for user %d and page %d with pass " +
        "through param '%s' at %d", senderID, recipientID, passThroughParam,
        timeOfAuth);

    // When an authentication is received, we'll send a message back to the sender
    // to let them know it was successful.
    sendTextMessage(senderID, "Authentication successful");
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var isEcho = message.is_echo;
    var messageId = message.mid;
    var appId = message.app_id;
    var metadata = message.metadata;

    // You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;
    var quickReply = message.quick_reply;
    /* 
     *User vars
     *
     *
     */


    /* 
     *End of user vars
     *
     *
     */
     if(messageAttachments){
        
        client.hget(senderID,'payload',function(err,object){
            let redisPayload = object;
            let lat,long,prox;

            if(redisPayload === "requestLocation"){
               
                
                lat = messageAttachments[0].payload.coordinates.lat;
                long = messageAttachments[0].payload.coordinates.long;
                prox = lat+','+long+','+'100';
                axios.get('https://reverse.geocoder.api.here.com/6.2/reversegeocode.json', {
                        params: {
                            prox:prox,
                            mode: 'retrieveAddresses',
                            maxresults: '1',
                            gen: '9',
                            app_id: process.env.GEO_APP_ID,
                            app_code: process.env.GEO_APP_CODE


                        }

                    }).then(function(response){
                             //sada kada nadjemo koji je grad ubacit ga u bazu i u redis
                             let data =JSON.parse(JSON.stringify(response.data));
                             let city =data.Response.View[0].Result[0].Location.Address.City;
                    
                             let queryText = 'UPDATE users SET currentcity = $1 WHERE currentcity IS NULL OR currentcity IS NOT NULL AND userid = $2';
                            
                    
                            pool.query(queryText, [city,senderID])
                                .then(res => {
                                    console.log("<---------------------Adding new city ---------------------> ");
                                     getWeatherInfo(city).then(msg=>{
                                            sendTextMessage(senderID,msg);
                                            client.hmset(senderID,{
                                                'city':city,
                                                'payload':''
                                            });
                                        });
                                  

                                   
                                }).catch(e => setImmediate(()=>{throw e}));
                              

                    }).catch(function(error) {
                        console.log(error);

                    });



            }
        });


     }
    else if (isEcho) {
        /*let redisPayload;
        
            client.hget(senderID, 'payload', function(err, object) {
               
                redisPayload = object;
                console.log("----------------------------------------------------");
                console.log(senderID + " a redis payload = " + redisPayload);



                console.log("----------------------------------------------------");
                   if(redisPayload === "topSearchChoose"){
                sendTypingOn(senderID);
                setTimeout(function() {
                    topSearchChoose(senderID);
                    client.hmset(senderID, {
                        'payload': ''

                    });
                }, 1000);


            }

            });*/


        // Just logging message echoes to console
        console.log("Received echo for message %s and app %d with metadata %s",
            messageId, appId, metadata);
        return;
    } else if (quickReply) {
        var quickReplyPayload = quickReply.payload;
        console.log("Quick reply for message %s with payload %s",
            messageId, quickReplyPayload);
        if (quickReplyPayload === "topChooseYes") {
            client.hget(senderID, 'message', function(err, object) {
                topResultsQuestion(senderID, object);
                client.hmset(senderID, {
                    'payload': '',
                    'message': ''

                });

            });

        } else if (quickReplyPayload === "topChooseNo") {
            sendTypingOn(senderID);


            setTimeout(function() {
                sendTextMessage(senderID, "Okey, feel free to ask me anytime you want! 😎");


            }, 1500);




        } else if (quickReplyPayload === "topSearchChooseYes") {
            sendTypingOn(senderID);
            client.hget(senderID, 'message', function(err, object) {
                topSerachResultsQuestion(senderID, object);
                client.hmset(senderID, {
                    'payload': '',
                    'message': ''

                });


            });

        } else if (quickReplyPayload === "topSearchChooseNo") {
            sendTypingOn(senderID);


            setTimeout(function() {
                sendTextMessage(senderID, "Okey, feel free to 🔎 📙 anytime you want! 😎");


            }, 1500);


            //konj2
        }else if(quickReplyPayload === "downloadSearchChooseYes"){
                  
                sendTypingOn(senderID);
                setTimeout(function(){
                    sendTextMessage(senderID,"Wait for your file to download.");
                    setTimeout(function(){
                        //ovdje saljemo hget
                        client.hget(senderID, 'message', function(err, object) {
               
                        sendPdfFile(senderID,object);
                    

                        });
                          client.hmset(senderID, {
                                    'payload': 'topSearchChoose',
                                    
                        });
                        
                    },3000);

                },1000);
                

        }else if(quickReplyPayload === "downloadSearchChooseNo"){
                sendTypingOn(senderID);
                  client.hmset(senderID, {
                                    'payload': 'topSearchChoose',
                                    'message':'',

                        });
                setTimeout(function(){
                    sendTextMessage(senderID,"No problem sir, you can download files any time you want.")
                  
                },1000);
            
        }




        return;
    }


    if (messageText) {
        var redisPayload;
        client.hget(senderID, 'payload', function(err, object) {
        
            redisPayload = object;

            if (redisPayload === "askPayload") {

                sendTypingOn(senderID);
                    
                axios.get(API_URL+'/api/Api', {
                        params: {
                            question: messageText,
                            
                        }

                    })
                    .then(function(response) {
                        console.log(response.data);
                        setTimeout(function() {

                            sendTextMessage(senderID, response.data);
                            client.hmset(senderID, {
                                'payload': 'topChoose',
                                'message': messageText

                            });

                        }, 1500);

                    })
                    .catch(function(error) {
                        console.log(error);
                        let gifUrl = 'https://media.giphy.com/media/W920wi2GVMv96/giphy.gif';
                        sendTextMessage(senderID,'Me right now wait for it 😂😂😂');

                        sendGifMessage(senderID,gifUrl);
                        client.hmset(senderID, {
                            'payload': '',
                            'message': ''

                         });
                    });




            } else if (redisPayload === "suggestPayload") {
                sendTypingOn(senderID);
                client.hmset(senderID, {
                    'payload': '',
                    'message': messageText

                });
                setTimeout(function() {
                    axios.post(API_URL+'/api/Api', {
                        userSuggestion: messageText

                    }).then(function(response) {
                        console.log(response);
                        sendTextMessage(senderID, 'Your suggestion is added thank You!');
                    }).catch(function(error) {
                        console.log(error);
                        sendTextMessage(senderID, 'Oops i spilled water all over my PC.... Halppp  🔥 all around me call 🚒 . Joke all is good i\'ll add your suggestion later 😂');
                    });


                }, 1500);
                //konj3
            } else if (redisPayload === "searchPayload") {
                //ovdje moram popravit jer prije stigne pitanje nego document...
                sendTypingOn(senderID);
              
                axios.get(API_URL+'/api/Books', {
                        params: {
                            question: messageText


                        }

                    })
                    .then(function(response) {



                        setTimeout(function() {

                            sendTextMessage(senderID, "I found your text in this file: " +response.data);
                            
                              client.hmset(senderID, {
                                    'payload': 'downloadSearchChoose',
                                    'message':response.data,

                                });



                        }, 1500);

                    })
                    .catch(function(error) {
                        console.log(error);
                            client.hmset(senderID, {
                                    'payload': ''

                                });
                        sendTextMessage(senderID, 'Oops how embarrassing 😬 i was playing with matches and i accidentally ignited 🔥 our library 😵😱 don\'t tell to my boss! ');

                    });




            }
            //end of else if
            else {
                sendTypingOn(senderID);
                const dialogFlowRequest = {
                    session: sessionPath,
                    queryInput: {
                      text: {
                        text: messageText,
                        languageCode: languageCode,
                      },
                    },
                  };
                sessionClient.detectIntent(dialogFlowRequest)
                    .then(responses => {
                      const result = responses[0].queryResult;
                        //console.log(result);
                      setTimeout(function() {

                      if(result.intent && result.intent.displayName === 'Getweather' ){
                        const city = result.parameters.fields['geo-city'].stringValue;
                      
                        if(!city){
                            //ovdje pitat za lokaciju! quick replies!
                            //sendTextMessage(senderID,"Please enter name of city.");
                            //probat prvo nac u bazi grad ako ga nema pozvat request, spasit u bazu i dodat u redis
                            // a ako ga ima dodat ga u redis..
                            //prije svega toga probat ga nac u redisu
                              client.hget(senderID,'city',function(err,object){
                           

                                if(!object){
                                    
                                      pool.query('SELECT * FROM users WHERE userid = $1',[senderID])
                                .then(res => {
                                    let userCity = res.rows[0].currentcity;
                                    if(!userCity){
                                        
                                        requestLocation(senderID);
                                        client.hmset(senderID, {
                                            'payload': 'requestLocation'

                                        });

                                    }
                                    else{
                                     
                                            getWeatherInfo(userCity).then(msg=>{
                                            sendTextMessage(senderID,msg);
                                            client.hmset(senderID,{
                                                'city':userCity
                                            });
                                        });   

                                    }
                                    
                                   
                                }).catch(e => setImmediate(()=>{throw e}));


                                }
                                else if(object){
                                    
                                    getWeatherInfo(object).then(msg=>{
                                        sendTextMessage(senderID,msg);
                                        
                                    });  

                                }


                              });
                          
                           

                               
                            
                        }
                        else{
                           

                             getWeatherInfo(city).then(msg=>{
                            sendTextMessage(senderID,msg);
                        });
                        }
                       
                      }
                      else if(result.intent && result.intent.displayName === 'Joke'){
                        requestPromise(jokeOptions)
                            .then(function(data){
                                 sendTextMessage(senderID,data.joke);   
                                 //console.log(data.joke);
                            });

                      }
                      else if(result.intentl && result.intent.displayName === 'Quotes'){
                        // These code snippets use an open-source library. http://unirest.io/nodejs
                        unirest.post("https://andruxnet-random-famous-quotes.p.mashape.com/?cat=famous")
                        .header("X-Mashape-Key", "Rw2S9kl085mshbEpomvKqczjvIgZp1TXcYkjsnJGakir3TlGvC")
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .header("Accept", "application/json")
                        .end(function (result) {
                          console.log(result.status, result.headers, result.body);
                          let msg ='"'+result.body[0].quote +'" '+result.body[0].author; 
                          sendTextMessage(senderID, msg);

                        });


                      }
                      else{
                        sendTextMessage(senderID, result.fulfillmentText);

                      }
                       },1500);
                    })
                    .catch(err => {
                      console.error('ERROR:', err);
                    });
                //ako cemo ovo stavljat u get started onda ovdje samo treba uzet iz redisa ime i prezime 
               
                 
                    const now = new Date();
                   
                    
                    let first_name,last_name;
                    client.hget(senderID,'firstname',function(err,object){
                        first_name = object;
                        client.hget(senderID,'lastname',function(err,object){
                            last_name = object;
                            var text = 'INSERT INTO users_data(userid,firstname,lastname,message,timestamp) VALUES($1, $2, $3, $4, $5) RETURNING *';
                            var values = [senderID,first_name,last_name,messageText,now];
                    
                            pool.query(text, values)
                                .then(res => {
                                    console.log("Adding data for data mining. "+res.rows[0]);
                                   
                                }).catch(e => setImmediate(()=>{throw e}));
                                
           
                        });
                    
                    });
                    







                

            }
            //end of else
        });



    }


    /*if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'image':
        sendImageMessage(senderID);
        break;

      case 'gif':
        sendGifMessage(senderID);
        break;

      case 'audio':
        sendAudioMessage(senderID);
        break;

      case 'video':
        sendVideoMessage(senderID);
        break;

      case 'file':
        sendFileMessage(senderID);
        break;

      case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID);
        break;        

      case 'read receipt':
        sendReadReceipt(senderID);
        break;        

      case 'typing on':
        sendTypingOn(senderID);
        break;        

      case 'typing off':
        sendTypingOff(senderID);
        break;        

      case 'account linking':
        sendAccountLinking(senderID);
        break;
      



      default:{
        /*
                                 axios.get('https://709e9230.ngrok.io/api/Api?=%22howto%22')//,{
                        //params:{
                        //  Api:messageText
                        //}

                //})
                            .then(function(response){
                            console.log(response.data);
                            sendTextMessage(senderID, response.data);
                })
                .catch(function(error){
                console.log(error);

                });
    

    
        
    
        }
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }*/
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var delivery = event.delivery;
    var messageIDs = delivery.mids;
    var watermark = delivery.watermark;
    var sequenceNumber = delivery.seq;

    if (messageIDs) {
        messageIDs.forEach(function(messageID) {
            console.log("Received delivery confirmation for message ID: %s",
                messageID);
        });
        var redisPayload;
        client.hget(senderID, 'payload', function(err, object) {

            redisPayload = object;
            if (redisPayload === "topChoose") {
                sendTypingOn(senderID);
                  client.hmset(senderID, {
                        'payload': ''

                    });
                setTimeout(function() {
                    topChoose(senderID);
                  
                }, 1000);
            } else if (redisPayload === "topSearchChoose") {


                sendTypingOn(senderID);
                    client.hmset(senderID, {
                        'payload': ''

                    });
                setTimeout(function() {
                    topSearchChoose(senderID);
                
                }, 1000);
                //konj
            }else if(redisPayload === "downloadSearchChoose"){
                    client.hmset(senderID, {
                        'payload': ''

                    });

                sendTypingOn(senderID);
                setTimeout(function(){
                    downloadSearchChoose(senderID);
                 

                },1000);
                    


            }



        });
    }

    console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;

    // The 'payload' param is a developer-defined field which is set in a postback 
    // button for Structured Messages. 
    var payload = event.postback.payload;
    switch (payload) {
        case 'ASK_PAYLOAD':
            askPayload(senderID);
            break;
        case 'SUGGEST_PAYLOAD':
            suggestPayload(senderID);
            break;
        case 'SEARCH_PAYLOAD':
            searchPayload(senderID);
            break;
        case 'ADD_CLOUD_PAYLOAD':
            addCloudPayload(senderID);
            break;
        case 'GET_STARTED_PAYLOAD':
            getStarted(senderID);
            break;

        default:
            // When a postback is called, we'll send a message back to the sender to 
            // let them know it was successful
            sendTextMessage(senderID, "Postback called");

    }
    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);
    //sendTextMessage(senderID, "Postback called");

}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    // All messages before watermark (a timestamp) or sequence have been seen.
    var watermark = event.read.watermark;
    var sequenceNumber = event.read.seq;


    console.log("Received message read event for watermark %d and sequence " +
        "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    var status = event.account_linking.status;
    var authCode = event.account_linking.authorization_code;

    console.log("Received account link event with for user %d with status %s " +
        "and auth code %s ", senderID, status, authCode);
}
/*
 *  Start of user functions
 *
 *
 *
 *
 */
 function requestLocation(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: "Please share your location.",
            quick_replies: [
                {
                    "content_type":"location"
                }

            ]
        }
    };

    callSendAPI(messageData);
}
 function sendPdfFile(recipientId,file) {
    let url = "https://www.digiqal.org/Pdf/"+file;
    console.log("IME FAJLA: "+file);

    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "file",
                payload: {
                    is_reusable: true,
                    url: url
                }
            }
        }
    };

    callSendAPI(messageData);
}
 function downloadSearchChoose(recipientId){
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: "Do you want to download file now? 🙈",
            quick_replies: [{
                    "content_type": "text",
                    "title": "Yes",
                    "payload": "downloadSearchChooseYes"
                },
                {
                    "content_type": "text",
                    "title": "No",
                    "payload": "downloadSearchChooseNo"
                }

            ]
        }
    };

    callSendAPI(messageData);



 }
function topSearchChoose(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: "Do you want to see more relevant contents? 🙈",
            quick_replies: [{
                    "content_type": "text",
                    "title": "Yes",
                    "payload": "topSearchChooseYes"
                },
                {
                    "content_type": "text",
                    "title": "No",
                    "payload": "topSearchChooseNo"
                }

            ]
        }
    };

    callSendAPI(messageData);
}

function topChoose(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: "Did you find your answer? Do you want to see more results?",
            quick_replies: [{
                    "content_type": "text",
                    "title": "Yes",
                    "payload": "topChooseYes"
                },
                {
                    "content_type": "text",
                    "title": "No",
                    "payload": "topChooseNo"
                }

            ]
        }
    };

    callSendAPI(messageData);
}

//function for showing if user want more materials or no!
function topSerachResultsQuestion(recipientId, userQuestion) {
    var url = API_URL+"/api/TopBooks?question=" + userQuestion+ "&top=";
    var messageData = {
        recipient: {
            id: recipientId

        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "📁 Choose how many documents you want to see",
                    buttons: [{
                        type: "web_url",
                        url: url+3,
                        title: "Top 3 search results ✔️",

                    }, {
                        type: "web_url",
                        url: url+5,
                        title: "Top 5 search results ✔️",

                    }, {
                        type: "web_url",
                        url: url+10,
                        title: "Top 10 search results ✔️",

                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}




//function for showing if user want more results or no



function topResultsQuestion(recipientId, userQuestion) {
    var url = API_URL+"/api/Api?question=" + userQuestion + "&top=";
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Choose how many answers you want to see",
                    buttons: [{
                        type: "web_url",
                        url: url + 3,
                        title: "Top 3 search results ✔️",

                    }, {
                        type: "web_url",
                        url: url + 5,
                        title: "Top 5 search results ✔️",

                    }, {
                        type: "web_url",
                        url: url + 10,
                        title: "Top 10 search results ✔️",

                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}




//this function is called when user press get started button
function getStarted(senderID) {
    let url = 'https://graph.facebook.com/v2.6/' + senderID;
                axios.get(url, {
                    params: {
                        fields: "first_name,last_name",
                        access_token: PAGE_ACCESS_TOKEN
                    }
                }).then(function(response) {

                    client.hmset(senderID, {
                        'payload': '',
                        'message': '',
                        'top': '',
                        'firstname':response.data.first_name,
                        'lastname':response.data.last_name,
                        'city':''

                    });
                    /*var todayEnd = new Date().setHours(23, 59, 59, 999);
                    client.expireat(senderID, parseInt(todayEnd/1000));*/
                    client.expire(senderID,1800);

                    const dbClient = new Client({
                        connectionString: process.env.DATABASE_URL,
                        ssl: true,


                    });
                    
                   
                    dbClient.connect();
                    var text = 'INSERT INTO users(userid,firstname,lastname) VALUES($1, $2, $3) RETURNING *';
                    var values = [senderID,response.data.first_name,response.data.last_name];
                    //var values =[["8903890439869"],"Enis","Habul","hey",now];
                // promise
                    dbClient.query(text, values)
                        .then(res => {
                            console.log("Adding user info to DB "+res.rows[0]);
                             dbClient.end();
                        })
                        .catch(e => console.error(e.stack));





                }).catch(function(error) {
                    console.log(error);
                });

                sendTextMessage(senderID, "Choose one of the options in menu or we can just talk.");




    
    

}

//this function is for asking questions
function askPayload(senderID) {


    sendTypingOn(senderID);
    client.hmset(senderID, {
        'payload': 'askPayload'

    });
    setTimeout(function() {

        sendTextMessage(senderID, "Write your question and i will try to find best answer for you 😺");



    }, 1000);

}
//this function is for suggesting questions
function suggestPayload(senderID) {
    sendTypingOn(senderID);
    client.hmset(senderID, {
        'payload': 'suggestPayload'

    });
    setTimeout(function() {

        sendTextMessage(senderID, "Write your question suggestion and my boss will review it (he thinks that he is smarter than me haha) 😺");



    }, 1000);


}

//this function is for searching materials
function searchPayload(senderID) {
    sendTypingOn(senderID);
    client.hmset(senderID, {
        'payload': 'searchPayload',


    });
    setTimeout(function() {

        sendTextMessage(senderID, "Write a sentence which describes content of your book that you want to search in our University library 📚");



    }, 1000);

}
//this function is for adding materials to cloud
function addCloudPayload(senderID) {
    sendTextMessage(senderID, "You entered in 🚫 area please leave!! This place is ☢️  jk 🤣 we didn't have time to implement this.");
    //removePersistentMenu();

}




/*
 *  End of user functions
 *
 *
 *
 *
 */
/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "image",
                payload: {
                    url: SERVER_URL + "/assets/rift.png"
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId,url) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "image",
                payload: {
                    url: url
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "audio",
                payload: {
                    url: SERVER_URL + "/assets/sample.mp3"
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "video",
                payload: {
                    url: SERVER_URL + "/assets/allofus480.mov"
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "file",
                payload: {
                    is_reusable: true,
                    url: "https://www.cpd.org.au/wp-content/uploads/2014/11/placeholder.pdf"
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "This is test text",
                    buttons: [{
                        type: "web_url",
                        url: "https://www.oculus.com/en-us/rift/",
                        title: "Open Web URL"
                    }, {
                        type: "postback",
                        title: "Trigger Postback",
                        payload: "DEVELOPER_DEFINED_PAYLOAD"
                    }, {
                        type: "phone_number",
                        title: "Call Phone Number",
                        payload: "+16505551234"
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "rift",
                        subtitle: "Next-generation virtual reality",
                        item_url: "https://www.oculus.com/en-us/rift/",
                        image_url: SERVER_URL + "/assets/rift.png",
                        buttons: [{
                            type: "web_url",
                            url: "https://www.oculus.com/en-us/rift/",
                            title: "Open Web URL"
                        }, {
                            type: "postback",
                            title: "Call Postback",
                            payload: "Payload for first bubble",
                        }],
                    }, {
                        title: "touch",
                        subtitle: "Your Hands, Now in VR",
                        item_url: "https://www.oculus.com/en-us/touch/",
                        image_url: SERVER_URL + "/assets/touch.png",
                        buttons: [{
                            type: "web_url",
                            url: "https://www.oculus.com/en-us/touch/",
                            title: "Open Web URL"
                        }, {
                            type: "postback",
                            title: "Call Postback",
                            payload: "Payload for second bubble",
                        }]
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
    // Generate a random receipt ID as the API requires a unique ID
    var receiptId = "order" + Math.floor(Math.random() * 1000);

    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "receipt",
                    recipient_name: "Peter Chang",
                    order_number: receiptId,
                    currency: "USD",
                    payment_method: "Visa 1234",
                    timestamp: "1428444852",
                    elements: [{
                        title: "Oculus Rift",
                        subtitle: "Includes: headset, sensor, remote",
                        quantity: 1,
                        price: 599.00,
                        currency: "USD",
                        image_url: SERVER_URL + "/assets/riftsq.png"
                    }, {
                        title: "Samsung Gear VR",
                        subtitle: "Frost White",
                        quantity: 1,
                        price: 99.99,
                        currency: "USD",
                        image_url: SERVER_URL + "/assets/gearvrsq.png"
                    }],
                    address: {
                        street_1: "1 Hacker Way",
                        street_2: "",
                        city: "Menlo Park",
                        postal_code: "94025",
                        state: "CA",
                        country: "US"
                    },
                    summary: {
                        subtotal: 698.99,
                        shipping_cost: 20.00,
                        total_tax: 57.67,
                        total_cost: 626.66
                    },
                    adjustments: [{
                        name: "New Customer Discount",
                        amount: -50
                    }, {
                        name: "$100 Off Coupon",
                        amount: -100
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: "What's your favorite movie genre?",
            quick_replies: [{
                    "content_type": "text",
                    "title": "Action",
                    "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
                },
                {
                    "content_type": "text",
                    "title": "Comedy",
                    "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
                },
                {
                    "content_type": "text",
                    "title": "Drama",
                    "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
                }
            ]
        }
    };

    callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
    console.log("Sending a read receipt to mark message as seen");

    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: "mark_seen"
    };

    callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
    console.log("Turning typing indicator on");

    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_on"
    };

    callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
    console.log("Turning typing indicator off");

    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_off"
    };

    callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Welcome. Link your account.",
                    buttons: [{
                        type: "account_link",
                        url: SERVER_URL + "/authorize"
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: messageData

    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
        }
    });
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});

module.exports = app;