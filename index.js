/*TODO: ENSURE unique infoHash on torrents
//TODO: gazelle titles show torrents
  TODO: get rid of whitespace on tags
  //check tags on create class
  //todo: delete class
  //todo: empty string getting added to tag uploaded when tags absent (did a frontend hotfix)
  //TODO: Time for titles
  //TODO: delete torrents from collection TEST this
  //todo: class rows
*/

const express = require('express')
const bodyParser= require('body-parser')
const app = express()
const util = require('util')

var he = require('he')

//const he = require('he');

var async = require('async')

var tripcode = require('tripcode');

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://root:root@cluster0.k4kb4.mongodb.net/SolomonsHouse?retryWrites=true&w=majority";

const { check, validationResult } = require('express-validator');
const port = 3000

const PAGE_LIMIT = 27;

var ObjectId = require('mongodb').ObjectId;      

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }))

app.listen(port, () => {

  /*const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {
      const col = client.db("SolomonsHouse").collection("titles");
      // perform actions on the collection object

      col.findOne({ infoHash: "220d371932c5eccef31373d6bf8e811011e559ee" }, function(err, document){
        
        if(err) cb(err);
        console.log(document);
        client.close();
       }
    );

  });*/
  console.log(`Example app listening at http://localhost:${port}`)
})

var route = "";

app.get("/load_index", function(req,res){
  load_index(function(err, result){
    if(err){
      console.log(err);
    }
    else{
      res.json({result})
    }
  })
})

function load_index(cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


//gets 5 most recent docs
  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("titles");
  //selects posts with "t" in the thread variable
    col.find().sort({time: -1}).limit(5).toArray(function(err, docs){
     client.close(); 
     if(err){
      cb(err);
     }
     else{
      cb(null, docs);
     }
    })
  })
}

app.post('/new_upload', [
    check('tripcode').trim().escape(),
    check('name').trim().not().isEmpty().escape().toLowerCase(),
    check('publisher').trim().escape().toLowerCase(),
    check('edition').trim().escape().toLowerCase(),
    check('tags').trim().escape().toLowerCase(),
    check('persons').trim().escape().toLowerCase(),
    check('infoHash').not().isEmpty().isLength(40).trim().escape(),
    check('bitrate').trim().escape(),
    check('format').trim().escape(),
    check('media').trim().escape(),
    check('type').not().isEmpty().trim().escape().toLowerCase(),
    check('date').trim().escape().toLowerCase(),
    check('edition_date').trim().escape().toLowerCase(),
    check('form').trim().escape().toLowerCase(),
    check('format').trim().escape().toLowerCase(),
    check('img').trim().escape(),
    check('size').trim().escape(),
    check('location').trim().escape(),
    check('pages').trim().escape(),
    check('description').trim().escape(),
    check('number').trim().escape(),
    check('class').trim().escape(),
    check('codec').trim().escape(),
    check('release').trim().escape()
  ],
  function(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if(req.body.classID && !ObjectId.isValid(req.body.classID)){
      return res.status(400).json({errors : "ClassID not valid."})
    }

    var trip;
    if(req.body.tripcode === ""){
      trip = "Anonymous"
    }
    else{
      trip = tripcode(req.body.tripcode);
    }


    //create tags and clear whitespace from them
    var tags = []
    req.body.tags.split(",").forEach(function(tag){
      if(tag){
        tags.push(tag.trim().replace(/ /g,"."));
      }
    })

    var titleInfo = {
      "type" : req.body.type,
      "persons" : JSON.parse(decodeHtml(req.body.persons)),
      "name" : req.body.name,
      "tags" : tags,
      "date" : req.body.date,  
      "time" : new Date(),
      "img" : req.body.img,
      "description" : req.body.description,
      "comments" : [],
      "snatched" : 0
    }

    var torrentInfo = {
      "release" : req.body.release,
      "tripcode" : trip,
      /*publisher, edition, pages: this is experimental */ 
      "publisher" : req.body.publisher,
      "edition" : req.body.edition,
      "number" : req.body.number,
      "pages" : req.body.pages,

      "location" : req.body.location,      
      "edition_date" : req.body.edition_date,
      
      /*this is just as on What.CD */
      "media" :req.body.media,
      "format" :req.body.format,
      "bitrate" : req.body.bitrate,

      /* PTP adds codec; PDFs have no equiv */

      "codec" : req.body.codec,

      "size" : req.body.size,
      "time" : new Date(),     
      "infoHash" : req.body.infoHash,      
      
      "snatched" : 0
    }

    upload(titleInfo, torrentInfo, req.body.classID, function(err, result){
      if(err){
        console.log(err)
        res.status(400).send();
      }
      else{
        console.log(result)
        res.status(204).send()
        res.end();  
      }

    });
    
});



function upload(titleInfo, torrentInfo, classID, kb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  client.connect(err => {
    
    // perform actions on the collection object

   

    for(let prop in titleInfo) if(!titleInfo[prop]) delete titleInfo[prop];

    var persons = titleInfo.persons;

    var tags = titleInfo.tags;

    delete titleInfo["persons"]
    delete titleInfo["tags"]

    async.waterfall([
      function (cb){
        const col = client.db("SolomonsHouse").collection("titles");
        col.findOneAndUpdate({name: titleInfo.name, type: titleInfo.type},
        {
          $addToSet: {persons: { $each: persons}, 
            tags: { $each: tags }, 
            torrents: torrentInfo}, 
          $set: titleInfo,
          $max : {
            max_size : torrentInfo.size
          } }, 
          {upsert: true}, 
        function(err,doc) {
         if (err) { 
          console.log(err);
          cb(err);
         }
         else { 
          //console.log("Updated " + doc.value.torrents);
          console.log(doc);
          cb(null, doc.value);
          
        }
       });  
      },
      function(doc1, cb){        
        console.log("DOCUMENT: " + doc1)
        const col = client.db("SolomonsHouse").collection("torrents");
         col.findOneAndUpdate({infoHash: torrentInfo.infoHash},
        {
          $set: torrentInfo 
        }, 
          {upsert: true}, 
        function(err,doc) {
         if (err) { 
          cb(err);
         }
         else { 
          //console.log("Updated " + doc.value.torrents);
          cb(null, doc1);
          
        }
       });  
      }
     ],function(err, result){
      if(err){
        kb(err);
      }
      else{
        client.close();
        kb(null, result) 
       
      }
        
     })

  });

}

app.get("/forum", [check('view').trim().escape().toLowerCase(), check('doc').trim().escape(), check('page').trim().escape()], function(req,res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }    
    forum(req.query.view, req.query.doc, req.query.page, function(err, result){
      if(err){
        console.log(err);
      }
      else{
        res.json({result});
      }
    });
})

//thread title not empty
function forum(view, doc, page, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("forums");
    console.log(view);
    // perform actions on the collection object
    if(view === "section"){
      //make sure you parseInt since sanitization stringifies everything
      col.find({ "section" : parseInt(doc), "$and":[{"thread":{"$ne":""}}]}).sort({recentDate: -1}).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).toArray(function(err, docs){
        
      if(err){
        cb(err);
      }
      else{
        cb(null, docs);
        client.close();
      }
        
    });
    }
    //view=thread&doc=id
    //forum page limit different from torrent page limit?
    //TODO pagination for forums, rn it just limits to 77
    else if(view==="thread"){
      console.log("PAGE : " + page);
      console.log("HERE IN THREAD " + doc);
      col.find({ threadID : ObjectId(doc)}).sort({_id: 1}).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).toArray(function(err, docs){
        
      if(err){
        cb(err);
      }
      else{
        console.log(docs);
        cb(null, docs);
        client.close();
      }
        
    });
    }
    else{
      col.find({"$and":[{"thread":{"$ne":""}}]}).sort({recentDate: -1}).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).toArray(function(err, docs){
        
      if(err){
        cb(err);
      }
      else{
        cb(null, docs);
        client.close();
      }
        
    });
    }
  })
}

//doc points to the section # when creating a new thread
app.post("/forum_post", [check("tripcode").trim().escape(), check('section').trim().escape(), check('thread').trim().escape(), check('threadTitle').trim().escape(), check("threadID").trim().escape(), check('doc').trim().escape(), check("postBody").trim().escape().isLength({max : 3000})], function(req,res){
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }    

  //TODO: get threadTitle on clientside when view is thread
  //threadID will be added in thread replies form (when view is thread)
  //TODO: dont allow empty thread title
  var threadID;
  var postCount;

  if(req.body.thread){
    //this is a thread
    threadID = ObjectId();
    postCount = 0;
  }
  else{
    //this is not a thread; threadID comes from the clientside
    threadID = ObjectId(req.body.threadID); //check this
  }

  console.log(threadID);

  var trip;
  if(req.body.tripcode === ""){
    trip = "Anonymous"
  }
  else{
    trip = tripcode(req.body.tripcode);
  }

  var postInfo = {
    section : parseInt(req.body.section),
    threadTitle : req.body.threadTitle,
    threadID : threadID,
    postBody : req.body.postBody,
    date : new Date(),
    trip: trip,
    postCount  : postCount
  }

  console.log(postInfo);
  forum_post(req.body.view, postInfo, function(err, result){
    if(err){
      console.log(err);
    }
    else{
      res.status(204).send();
    }

  })
})

function forum_post(view, postInfo, kb){

    
    // perform actions on the collection object
    console.log(view);
    //if(view === "section"){
      async.waterfall([
        function(cb){
          const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

          client.connect(err => {
          const col = client.db("SolomonsHouse").collection("forums");

           col.insertOne(postInfo, function(err, docs){
                
              if(err){
                cb(err);
              }
              else{
                client.close();
                cb(null, postInfo);
                
              }
                
            });
          })
        },
        function(postInfo, cb){
          const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


          client.connect(err => {
            const col = client.db("SolomonsHouse").collection("forums");
          //selects posts with "t" in the thread variable
            col.updateOne({thread : { $nin : [""] }, threadID : new ObjectId(postInfo.threadID)},
            {$set : { recentTrip : postInfo.trip, recentDate : postInfo.date}, $inc : { postCount : 1}}, function(err, doc){
             client.close(); 
             cb(null);
            })
          })
        }
        ], function(err){
          
          if(err){
            kb(err);

          }
          else{
            kb(null);
          }
        })
     
  //  }
    //else{
     // cb(null);
   //   client.close();
   // }
    
  
}

app.get("/load_forums_posting", [check('doc').trim().escape()], function(req,res){
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }    
  console.log("DOC: " + req.query.doc);
  load_forums_posting(req.query.doc, function(err, result){
    if(err){
      console.log(err)
    }
    else{
      res.json({result});
    }
  })
})

function load_forums_posting(doc, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("forums");

    //if(view === "section"){
      col.findOne({threadID : new ObjectId(doc)}, function(err, doc){
      if(err){
        cb(err);
      }
      else{        
        client.close();
        cb(null, doc);
      }
        
    });
  //  }
    //else{
     // cb(null);
   //   client.close();
   // }
    
  })  
}

//see top_10 has an underscore here for the serverside. the clientside route is top10 and they cannot be identical,
//because otherwise going to the clientside route would directly call the server app route
app.get("/top_10", function(req,res){
  //check for validator errors?

  top_10(function(err, result){
    if(err){
      console.log(err);
    }
    else{
      res.json({
        day: result[0],
        week : result[1],
        month: result[2],
        year : result[3],
        time : result[4]
      })
    }

  });
})


function top_10(kb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("titles");
    // perform actions on the collection object

   function getYesterday(){
      return new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
    }

    function getLastWeek() {
      var today = new Date();
      var lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      return lastWeek;
    }

    function getLastMonth(){
      var x = new Date();
      x.setDate(1);
      x.setMonth(x.getMonth()-1);
      return x;
    }

    function getLastYear(){
      var d = new Date();
      var pastYear = d.getFullYear() - 1;
      d.setFullYear(pastYear);
      return d;
    }
    
    async.series([
      //past day

      function(cb){
        col.find({"torrents.time" : {$gte : getYesterday()}}).sort({"torrents.snatched" : -1}).limit(10).toArray(function(err, docs){
        
          if(err){
            cb(err);
          }
          else{
            cb(null, docs);          
          }
          
        });
      },
      function(cb){
        col.find({"torrents.time" : {$gte : getLastWeek()}}).sort({"torrents.snatched" : -1}).limit(10).toArray(function(err, docs){
        
          if(err){
            cb(err);
          }
          else{
            cb(null, docs);          
          }
          
        });
      },
      function(cb){
        col.find({"torrents.time" : {$gte : getLastMonth()}}).sort({"torrents.snatched" : -1}).limit(10).toArray(function(err, docs){
        
          if(err){
            cb(err);
          }
          else{
            cb(null, docs);         
          }
          
        });
      },
      function(cb){
        col.find({"torrents.time" : {$gte : getLastYear()}}).sort({"torrents.snatched" : -1}).limit(10).toArray(function(err, docs){
        
          if(err){
            cb(err);
          }
          else{
            cb(null, docs);           
          }
          
        });
      }
      ,
      //all time most snatched
      function(cb){
        col.find().sort({"torrents.snatched" : -1}).limit(10).toArray(function(err, docs){
        
          if(err){
            cb(err);
          }
          else{
            cb(null, docs);            
          }
          
        });
      }
    ],function(err, result){
      if(err){
        kb(err);
      }
      else{
        //make result obj?
        //result[0] : last day, result[1]: last week, etc
        client.close();
        kb(null, result);
      }
    })
    
  })

}


app.post("/edit/:collection/:id", [check('doc_tags').trim().escape().toLowerCase(), check('id').trim().escape(), check('collection').trim().escape(), check('doc_title_id').trim().escape(), check('doc_name').trim().escape().toLowerCase(), check('doc_img').trim().escape(),
  check('doc_description').trim().escape(), check('doc_img').trim().escape(), check('doc_date').trim().escape().toLowerCase(), 
  check('doc_persons').trim().escape().toLowerCase(), check("nontorrents").trim().escape(), check("nontags").trim().escape(), check('nonpersons').trim().escape().toLowerCase()],
  function(req, res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if(req.body.title_id && !ObjectId.isValid(req.body.doc_title_id)){
      return res.status(400).json({errors : "TitleID not valid."})
    }

    //clear whitespace from tags
    var tags = []
    req.body.doc_tags.split(",").forEach(function(tag){
      if(tag){
        tags.push(tag.trim().replace(/ /g,"."));
      }
    })

    var docInfo = {
      name : req.body.doc_name,
      date : req.body.doc_date,
      description : req.body.doc_description,
      img : req.body.doc_img,
      persons : req.body.doc_persons ? JSON.parse(decodeHtml(req.body.doc_persons)) : [],
      title_id : req.body.doc_title_id,
      nonpersons : req.body.nonpersons,
      nontorrents : req.body.nontorrents,
      nontags: req.body.nontags,
      tags: tags
    }
   
    edit_doc(req.params.id, req.params.collection, docInfo, function(err, result){
      if(err){
        console.log(err)
        res.status(400).send();
      }
      else{
        res.status(204).send() 
      }
      
    })
  })

function edit_doc(id, collection, docInfo, kb){
   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {

      console.log("EDIT DOC collection " + collection)
      const col = client.db("SolomonsHouse").collection(collection);

      for(let prop in docInfo) if(!docInfo[prop]) delete docInfo[prop];//it will remove fields who are undefined or null 
    
      if(docInfo.persons){
        var arr = docInfo.persons;
      }
      if(docInfo.title_id){
        var title_id = docInfo.title_id
      }
      if(docInfo.nonpersons){
        var nonpersons = docInfo.nonpersons;
      }
      if(docInfo.nontags){
        var nontags = docInfo.nontags;
      }
      if(docInfo.nontorrents){
        var nontorrents = docInfo.nontorrents;
      }
      if(docInfo.tags){
        var tags = docInfo.tags
      }
      delete docInfo["persons"]
      delete docInfo["nonpersons"]
      delete docInfo["nontorrents"]
      delete docInfo["nontags"]
      delete docInfo["title_id"]
      delete docInfo["tags"]
     // delete docInfo["title_id"] sketchy trick
      var params = docInfo;

      params.dummy = ""


      console.log("TITLE ID : " + title_id , "DOC INFO TAGS :" +tags);
      if(nonpersons){
        col.updateOne({_id: new ObjectId(id)}, 
        {
          $pull: {persons : { name : nonpersons}}
        }, function(err, docs){
          if(err){
            kb(err);
          }
          else{
            console.log("DOCS " + docs);
            kb(null, docs )//, numPages: numPages});
            client.close();   
          }

        })   
      }
      else if(nontorrents){
        async.series([
          function(cb){
            col.updateOne({_id: new ObjectId(id)}, 
            {
              $pull: {torrents : {infoHash : nontorrents}}
            }, function(err, docs){
              if(err){
                cb(err);
              }
              else{
                cb(null, docs);
              }
            })  
          },
          function(cb){
            var col2 = client.db("SolomonsHouse").collection("torrents");
            col2.remove({infoHash: nontorrents}, function(err, docs){
              if(err){
                cb(err);
              }
              else{
                cb(null, docs);
              }
            })  
          }
        ],function(err, result){
            
            kb(null, result[0] )//, numPages: numPages});
            client.close();  
        })
        
      }
      else if(nontags){
        col.updateOne({_id: new ObjectId(id)}, 
        {
          $pull: {tags : nontags}
        }, function(err, docs){
          if(err){
            kb(err);
          }
          else{
            console.log("DOCS " + docs);
            kb(null, docs )//, numPages: numPages});
            client.close();   
          }

        })  
      }
      //get title name and tags
      //this is when a titleID is added to a class "gazelle" document
      else if(title_id){
        async.waterfall([
          //first find title 
          function(cb){
            var col2 = client.db("SolomonsHouse").collection("titles"); 
            col2.findOne({_id : new ObjectId(title_id)}, function(err, doc){
              if(err){
                cb(err)
              }
              else{
                cb(null, doc);
              }
            })
          }
          ,
          function(title, cb){
            var titleObj = {
              _id : ObjectId(title._id),
              name : title.name,
              img : title.img,
              tags : title.tags,
              persons:  title.persons,
              date : title.date
            }
            col.findOneAndUpdate({_id: new ObjectId(id)}, 
                {
                  //title_id should be a string..
                  $addToSet: 
                    { titleList : titleObj},
                  $inc : { numTitles : 1},
                  $set : { time : new Date()}
                }, function(err, docs){
                  if(err){
                    kb(err);
                  }
                  else{
                    console.log("DOCS " + docs);
                    kb(null, docs )//, numPages: numPages});
                     
                  }

                })  
          }
          ], function(err, result){
            client.close();  
            if(err){
              kb(err);
            }
            else{
              kb(null, result);
            }
          })
        
        
      }
      else{
        col.updateOne({_id: new ObjectId(id)}, 
      {
        $set: params, 
        $addToSet: 
          { persons : { $each : arr }, tags: {$each : tags}}
      }, function(err, docs){
        if(err){
          kb(err);
        }
        else{
          console.log("DOCS " + docs);
          kb(null, docs )//, numPages: numPages});
          client.close();   
        }

      })   
      }
  
        

  }); 
}

app.post("/snatched", [check("infoHash").trim().escape()], function(req,res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  } 

  snatched(req.body.infoHash, function(err, result){
    if(err){
      console.log(err);
    }
    else{
     // console.log(result);
      res.json({})
    }
  });
})

function snatched(infoHash, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("titles");
    // perform actions on the collection object

    console.log("SNATCHED! " + infoHash);
    col.updateOne({ "torrents.infoHash" : infoHash}, {$inc: { "torrents.$.snatched" : 1, "snatched" : 1}}, function(err, docs){
        
      if(err){
        cb(err);
      }
      else{
        cb(null, docs);
        client.close();
      }
        
    });
  })
}


app.get('/pagination', [check('action').trim().escape(), check('publisher').trim().escape().toLowerCase(), check('date').trim().escape(), check('person').trim().escape().toLowerCase(), check('format').trim().escape(), check('collection').trim().escape().not().isEmpty(), check('terms').trim().escape(), check('type').trim().escape(), check("search").trim().escape(), check('tags').trim().escape(), check('taglist').trim().escape(), check("view").trim().escape(), check("doc").trim().escape()], (req,res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  var tags = [];
  if(req.query.tags !== "null"){
     //clear whitespace from tags    
    req.query.tags.split(",").forEach(function(tag){
      if(tag){
       tags.push(tag.trim().replace(/ /g,"."));
      }
    })
  }
  else{
    tags = []
  }

  paginate(req.query.action, req.query.media, req.query.bitrate, req.query.edition, req.query.number, req.query.pages, req.query.collection, req.query.view, req.query.doc, req.query.taglist, req.query.publisher, req.query.date, req.query.person, req.query.format, req.query.terms, tags, req.query.types, req.query.search, function(err, result){
    if(err){
      console.log(err);
    }
    else{

      var numPages = Math.ceil(result / PAGE_LIMIT);
      console.log(numPages);

      res.json({numPages : numPages})
 
    }
  })
})

function paginate(action, media, bitrate, edition, number, pages, collection, view, doc, taglist, publisher, date, person, format, terms, tags, types, search, cb){

  console.log("COLLECTION : " + collection)
  if(collection === "torrents"){
    collection = "titles";
  }
  if(collection === "forums"){
    
   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


      client.connect(err => {
        const col = client.db("SolomonsHouse").collection("forums");
        // perform actions on the collection object
        var query = {}

        if(view === "section"){
          console.log("THERE");
          query = {
            section : parseInt(doc),
            "$and":[{"thread":{"$ne":""}}]
          }
        }
        else if(view === "thread"){
          query = {
            threadID : ObjectId(doc)
          }
        }
        col.countDocuments(query, function(err, numDocs){
            
          if(err){
            cb(err);
          }
          else{
            console.log("NUMDOCS : " + numDocs)
            cb(null, numDocs);
            client.close();
          }
            
        });
    })
  }
  else if(search === "true"){     
    console.log("SEARCH : " + search);
   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

      client.connect(err => {
    const col = client.db("SolomonsHouse").collection("titles");
     var typeList = []
     console.log(types);
     if(types !== "null"){
      JSON.parse(decodeHtml(types)).forEach(function(type){
      switch(parseInt(type)){
        case 0 : 
          typeList.push("nonfiction");
          break;
        case 1:
          typeList.push("fiction");
          break;
        case 2:
          typeList.push("music")
          break;
        case 3:
          typeList.push('art');
          break;
        case 4:
          typeList.push("documentary");
          break;
        case 5:
          typeList.push('news')
          break;
        default:
          break;
      }
     })
     }

     if(typeList.length === 0){
      typeList = ["nonfiction", "fiction","music","art","documentary", "news"];
     }

     var query = {}
     if(action === "basic" || action === "null"){
        if(tags.length !== 0){
          query.tags = { $all : tags }
        }
        if(terms){
          query.$text = { $search : terms};
        }
     }
     else if(action==="advanced"){
      if(tags.length !== 0){
        query.tags = { $all : tags }
      }
      if(terms){
          query.$text = { $search : terms};
      }
      if(date){
          query.date = date
        }
        if(publisher){
          console.log("PUBLISHER: " + publisher)
          query["torrents.publisher"] = publisher        
        }
        if(format){
          query["torrents.format"] = format
        }
        if(person){
          query["persons.name"] = person;
        }
        if(media){
          query["torrents.media"] = media
        }
        if(bitrate){
          query["torrents.bitrate"] = bitrate
        }
        if(edition){
          query["torrents.edition"] = edition
        }
        if(number){
          query["torrents.number"] = number
        }
        if(pages){
          query["torrents.pages"] = pages;
        }
     }
            
        query.type = { $in : typeList}        

        console.log("----PAGINATION-----")
        console.log(query);
        
        col.countDocuments(query, function(err, numDocs){
               
        if(err){
          console.log(err);
          cb(err);
        }
        else{
          console.log("NumDocs " + numDocs);
          cb(null, numDocs)//, numPages: numPages});
          client.close();  
        }    

       });
      })
  }
  else{

    if(taglist){
      query = { tags : taglist }
      console.log(query);
    }
    else{
      query = {}
    }
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


    client.connect(err => {
      const col = client.db("SolomonsHouse").collection(collection);
      // perform actions on the collection object

      col.countDocuments(query, function(err, numDocs){
          
        if(err){
          cb(err);
        }
        else{
          cb(null, numDocs);
          client.close();
        }
          
      });
    })
  }
  

}

app.get('/browse', 
  [check('order_by').trim().escape(), check("sort_by").trim().escape(), check('page').trim().escape(), check('action').trim().escape(), check("edition").trim().escape().toLowerCase(), check("bitrate").trim().escape(), check("media").trim().escape(), check("number").trim().escape().toLowerCase(), check("pages").trim().escape().toLowerCase(), check("publisher").trim().escape().toLowerCase(), check("date").trim().escape(), check('search').trim().escape(), check('terms').trim().escape().toLowerCase(), check('types').trim().escape(), check("tags").trim().escape(), check("person").trim().escape().toLowerCase(), check('taglist').trim().escape()],
  (req,res) => {   
  const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  } 
  if(req.query.page === undefined){   
    var page = 1
  }
  else{
    var page = parseInt(req.query.page)
  }

  console.log("HERE!!!!!! " + req.query.types)

  //this is not for taglist but for tags.
  // taglist is currently not an Array but a single string element! uh oh
  var tags = [];
  if(req.query.tags !== "null"){
     //clear whitespace from tags    
    req.query.tags.split(",").forEach(function(tag){
      if(tag){
       tags.push(tag.trim().replace(/ /g,"."));
      }
    })
  }
  else{
    tags = []
  }

  console.log("PAGE : " + page, "TAGLIST: " + req.query.taglist + "PUBLISHER: " + req.query.publisher);
  load_titles(req.query.order_by, req.query.sort_by, req.query.action, req.query.media, req.query.bitrate, req.query.edition, req.query.number, req.query.pages, page, req.query.publisher, req.query.date, req.query.person, req.query.format, req.query.terms, req.query.types, tags, req.query.taglist, req.query.search, function(err, result){
   // console.log(result);
    //var numPages = result.numPages;
   
    if(err) {
      console.log(err);
      res.status(400).send();
    }
    else{
      var titles = result.documents;
      res.json({titles : titles, currentPage : page})
    }
  })
})

//this is called on browse. the app ajax calls /browse?query when the clientside route is /titles. these can't 
//have identical names because otherwise i cant separate clientside and serverside routing
function load_titles(order_by, sort_by, action, media, bitrate, edition, number, pages, page, publisher, date, person, format, terms, types, tags, taglist, search, kb){
   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

   var typeList = []
   console.log("HERE " + types);
   if(types !== "null"){
    JSON.parse(decodeHtml(types)).forEach(function(type){
    switch(parseInt(type)){
      case 0 : 
        typeList.push("nonfiction");
        break;
      case 1:
        typeList.push("fiction");
        break;     
      case 2:
        typeList.push("music")
        break;
      case 3:
        typeList.push('art');
        break;
      case 4:
        typeList.push("documentary");
        break;
      case 5:
        typeList.push("news");
        break;
      default:
        break;
    }
   })
   }

   if(typeList.length === 0){
    typeList = ["nonfiction", "fiction", "music","art","documentary","news"];
   }

    client.connect(err => {
      const col = client.db("SolomonsHouse").collection("titles");
      // perform actions on the collection object
      
      //TODO: extendable. how to build a query from search params?
      
      var numPages;
      console.log("TAGLIST : " +  taglist)
      var order;
        if(order_by === "desc"){
          order = -1
        }
        else{
          order = 1
        }

        var sort = {};

        if(!sort_by || sort_by === "null"){
          sort = {
            time : -1
          }
        }
        else{
          sort[sort_by] = order;  
        }
        console.log(sort);
      //not sure how to modify query based on search params. did it this way, disjunctive conditional
      if(taglist !== "null"){
        console.log("TAGLIST NOT NULL");
        var query = { tags : taglist }

        col.find(query).sort(sort).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).toArray(function(err, documents){
               
        if(err){
          kb(err);
        }
        else{
          kb(null, { documents : documents })//, numPages: numPages});
          client.close();  
        }    

       });
      }
      //search === 'true'
      else if(search !== "null"){

        var query = {}
        if(action ==="basic" || !action || action === "null"){
          if(tags.length !== 0){
          query.tags = { $all : tags }
          }
          if(terms){
            query.$text = { $search : terms};
          }
        }
        else if(action ==="advanced"){
          if(tags.length !== 0){
          query.tags = { $all : tags }
          }
          if(terms){
            query.$text = { $search : terms};
          }
          console.log("----ADVANCED SEARCH-----\n" + media + publisher);
          if(date){
            query.date = date
          }
          if(publisher){
            console.log("PUBLISHER: " + publisher)
            query["torrents.publisher"] = publisher        
          }
          if(format){
            query["torrents.format"] = format
          }
          if(person){
            query["persons.name"] = person;
          }
          if(media){
            query["torrents.media"] = media;
          }
          if(bitrate){
            query["torrents.bitrate"] = bitrate;
          }
          if(edition){
            query["torrents.edition"] = edition;
          }
          if(number){
            query["torrents.number"] = number;
          }
          if(pages){
            query["torrents.pages"] = pages;
          }
        }        
        
        query.type = { $in : typeList}        

        console.log(query);
        
        col.find(query).sort(sort).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).toArray(function(err, documents){
               
        if(err){
          kb(err);
        }
        else{
          kb(null, { documents : documents })//, numPages: numPages});
          client.close();  
        }    

       });
      }
      else{
        col.find().sort(sort).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).toArray(function(err, documents){
               
        if(err){
          kb(err);
        }
        else{
          kb(null, { documents : documents })//, numPages: numPages});
          client.close();  
        }    

       });
      }
      

  });
}

app.post('/adv_search', [check('collection').trim().escape(), check('text').trim().escape()],
  function(req, res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log(req.body.text);

    adv_search(req.query.collection, req.body.text, function(err, result){
      if(err){
        console.log(err);
        res.status(400).send();
      }
      else{
        console.log(result.documents);
        res.json({documents: result.documents})
      }

    })
    
  })

function adv_search(collection, text, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {

      const col = client.db("SolomonsHouse").collection(collection);
      // perform actions on the collection object
      const query = { $text: { $search: text } };
      col.find(query).toArray(function(err, documents){
               
        if(err){
          cb(err);
        }
        else{
          cb(null, { documents : documents })//, numPages: numPages});
          client.close();    
        }
        //console.log(documents);
            

      });

  });
}

app.get('/doc/:id', [check('id').trim().not().isEmpty().escape(), 
  check('collection').trim().escape().not().isEmpty()],
  function(req,res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    var id = req.params.id;

    if(ObjectId.isValid(id)){
      load_doc(id, req.query.collection, function(err, result){
       console.log("DOCUMENT:  " + result[1]);      
       if(err) console.log(err);
       res.json({doc : result[0], torrents : result[1]});
      })
    }
    else{
      //this is a depracated workaround
      res.status(204).send();
    }
 
  })

function load_doc(id, collection, kb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(id);
    client.connect(err => {
      var col = client.db("SolomonsHouse").collection(collection);
      // perform actions on the collection object

      async.series([
        function(cb){
          col.findOne({ _id: new ObjectId(id) }, function(err, document){
        
              if(err){
                cb(err)
              }
              else{
                cb(null, document);                
              }                           }
          );
        },
        function(cb){
          
          if(collection === "persons"){
            col = client.db("SolomonsHouse").collection("titles");
            col.find({ "persons._id" : id }).toArray(function(err, docs){ //id is not an ObjectId
        
              if(err){
                console.log(err);
                cb(err)
              }
              else{
               cb(null, docs);
               
              }
             }
            );
          }
          else{
            cb(null, null);
          }
        }
      ],function(err, result){
        client.close();
        if(err){
          kb(err);
        }
        else{
          kb(null, result)
        }
      })
     

  });
}

//magnet:?xt=urn:btih:f6b23338c27659d2b9b88973d50de77e342ee780&dn=A.E.+Waite&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337


app.post('/add_person', [
  check('name').trim().escape().not().isEmpty().toLowerCase(),
  ],

  function(req, res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    add_person(req.body.name, function(err, result){
      if(err){
        res.json({error : err})
      }
      else{

        console.log(result);
        res.json(result);
      }
    })
    
  }
)

app.get('/gazelle_classes', [
  check('page').trim().escape()], function(req,res){
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  load_classes(req.query.page, function(err, results){
    res.json({ classes: results.documents})
  });
})

function load_classes(page, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

      client.connect(err => {
        const col = client.db("SolomonsHouse").collection("classes");
        // perform actions on the collection object
       
        var numPages;
        col.find().skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT).sort({_id: -1}).toArray(function(err, documents){
                 
          if(err){
            cb(err);
          }
          else{
            cb(null, { documents : documents })//, numPages: numPages});
            client.close();  
          }     

        }
      );

    });
}

app.get('/torrent_info', [

  ],
  function(req,res){

  })

app.post('/create_class', [],
  function(req,res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    var tags = [];
    if(req.body.tags !== ""){
       //clear whitespace from tags    
      req.body.tags.split(",").forEach(function(tag){
        if(tag){
          tags.push(tag.trim().replace(/ /g,"."));
        }
      })
    }
    else{
      tags = []
    }
    create_class(req.body.name, tags, function(err, result){
      res.status(204).send();
    })
  })

function create_class(name, tags, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("classes")
    col.insertOne({name : name, numTitles : 0, tags : tags}, function(err, response){
      
      if(err){
        cb(err)
      }
      else{
        cb(null, response.ops[0])
        client.close();
      }

    })
  })
}


app.post('/comment', [check('_id').trim().escape(), check('body').trim().escape().isLength({max : 3000}).not().isEmpty(), check('trip').trim().escape()],
  function(req,res){

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if(!ObjectId.isValid(req.body._id)){
      return res.status(400).json({errors : "TitleID invalid"})
    }
    console.log("HERE!!!!!!!!!!!!!!!!")
    post_comment(req.body._id, req.body.body, req.body.trip, function(err, result){
      if(err){
        console.log(err);
      }
      else{
        res.status(204).send();
      }
    })
  })

function post_comment(_id, body, trip, cb){
  var poster;
    if(trip === ""){
      poster = "Anonymous"
    }
    else{
      poster = tripcode(trip);
    }

    var comment = {
      _id : ObjectId(),
      tripcode : poster,
      body : body,
      time: new Date()
    }
    console.log(comment);
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("titles")
    col.updateOne({_id : new ObjectId(_id)}, {$push : {comments :comment}}, function(err, response){
      
      if(err){
        cb(err)
      }
      else{
        cb(null, response)
        client.close();
      }

    })
  })
}

app.post('/create_person', [
  check('name').trim().escape().not().isEmpty().toLowerCase(),
  ],
  function(req, res){
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    create_person(req.body.name, function(err, result){
      console.log(result)
      if(err){
        res.json({error : err})
      }
      else{
        res.json(result)
      }
    })
  })


function add_person(name, cb){
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect(err => {
      const col = client.db("SolomonsHouse").collection("persons");
      // perform actions on the collection object

      col.findOne({ name: name }, function(err, documents){
        
        if(err){
          cb(err);
        }
        else{ 
          cb(null, documents);
          client.close();
        }
       }
    );

  });
}

function create_person(name, cb){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  client.connect(err => {
    const col = client.db("SolomonsHouse").collection("persons")
    col.insertOne({name : name}, function(err, response){
      
      if(err){
        cb(err)
      }
      else{
        cb(null, response.ops[0])
        client.close();
      }
      
    })
  })
}

app.all('*', (req, res) => {

/*...*/
  res.sendFile(__dirname + '/index.html')
 
})

function decodeHtml(html) {
    return he.decode(html);
}


