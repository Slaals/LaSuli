/*
HYPERTOPIC - Infrastructure for community-driven knowledge organization systems

OFFICIAL WEB SITE
http://www.hypertopic.org/

Copyright (C) 2010 Chao ZHOU, Aurelien Benel.

LEGAL ISSUES
This library is free software; you can redistribute it and/or modify it under
the terms of the GNU Lesser General Public License as published by the Free 
Software Foundation, either version 3 of the license, or (at your option) any
later version.
This library is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details:
http://www.gnu.org/licenses/lgpl.html
*/
var EXPORTED_SYMBOLS = ["RESTDatabase"];

const Exception = Components.Exception;
/*const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const include = Cu.import;
*/
Cu.import("resource://lasuli/modules/log4moz.js");
Cu.import("resource://lasuli/modules/XMLHttpRequest.js");
/**
 * @param baseURL The database URL.
 *                example: http://127.0.0.1:5984/test/
 */
function RESTDatabase(baseUrl) {
  var logger = Log4Moz.repository.getLogger("RESTDatabase");
  this.cache = {};
  var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  if(!baseUrl || baseUrl === "" || !regexp.test(baseUrl))
  {
    logger.fatal("BaseUrl is not validate:" + baseUrl);
    throw Exception('baseUrl is not vaildate!');
  }
  baseUrl = (baseUrl.substr(-1) == "/") ? baseUrl : baseUrl + "/";
  loggger.info("BaseUrl is:" + baseUrl);
  this.baseUrl = baseUrl;
  this.xhr = new XMLHttpRequest();
  this.xhr.overrideMimeType('application/json');
}

RESTDatabase.prototype = {
  /**
   * @param object null if method is GET or DELETE
   * @return response body
   */
  send : function(httpAction, httpUrl, httpBody)
  {
    var logger = Log4Moz.repository.getLogger("RESTDatabase.send");
    httpAction = (httpAction) ? httpAction : "GET";
    httpUrl = (httpUrl) ? httpUrl : this.baseUrl;
  
    httpBody = (!httpBody) ? "" : ((typeof(httpBody) == "object") ? JSON.stringify(httpBody) : httpBody);
    var result = null;
  
    try{
      this.xhr.open('GET', httpUrl, false);
      this.xhr.send('');
      
      return JSON.parse(http.responseText);
    }
    catch(e)
    {
      logger.error("Ajax Error, xhr.status: " + this.xhr.status + " " + this.xhr.statusText + ". \nRequest:\n" + httpAction + " " + httpUrl + "\n" + httpBody);
      throw Exception('Cannot get url: ' + httpUrl);
    }
  },
  
  
  /**
   * @param object The object to create on the server.
   *               It is updated with an _id (and a _rev if the server features
   *               conflict management).
   */
  Post : function(object) {
    var logger = Log4Moz.repository.getLogger("RESTDatabase.post");
    var body;
    try{
      body = this.send("POST", this.baseUrl, object);
      if(!body || !body.ok)
        throw Exception(JSON.stringify(body));
    }
    catch(e)
    {
      logger.error(object);
      logger.error(e);
      throw e;
    }
    
    object._id = body.id;
    if (body.rev)
      object._rev = body.rev;
    return object;
  },

  /**
   * Notice: In-memory parser not suited to long payload.
   * @param query the path to get the view from the baseURL 
   * @return if the queried object was like
   * {rows:[ {key:[key0, key1], value:{attribute0:value0}},
   * {key:[key0, key1], value:{attribute0:value1}}]}
   * then the returned object is
   * {key0:{key1:{attribute0:[value0, value1...]}}}
   * otherwise the original object is returned.
   */
  Get : function(query, force) {
    var logger = Log4Moz.repository.getLogger("RESTDatabase.get");
    force = (typeof(force) == 'boolean') ? force : true; 
    //TODO should write a worker to check the changes on couchdb
    query = (query) ? query : '';
    if(this.cache[query] && !force)
      return this.cache[query];
    
    var body;
    try{
      body = this.send("GET", this.baseUrl + query, null);
      if(!body)
        throw Exception(JSON.stringify(body));
    }catch(e)
    {
      logger.error(query);
      logger.error(e);
      throw e;
    }
    
    //TODO, need to rewrite this part of algorithm
    if(body.rows && body.rows.length > 0)  
    {
      var result = {};
      var rows = {};
      //Combine the array according to the index key.
      for(var i=0, row; row = body.rows[i]; i++)
      {
        var _key = JSON.stringify(row.key);
        if(!rows[_key])
          rows[_key] = new Array();
        rows[_key].push(row.value);
      }
      //log(rows);
      //Combine the value according to the value name.
      for(var _key in rows)
      {
        var obj = {};
        for(var i=0, val; val = rows[_key][i] ; i++)
        {
          for(var n in val)
          {
            if(!obj[n])
              obj[n] = new Array();
            obj[n].push(val[n]);
          }
        }
        rows[_key] = obj;
      }
      //log(rows);
      var result = {};
          
      for(var _key in rows)
      {
        var keys = JSON.parse(_key);
        var obj = null,tmp,key;
        if(typeof(keys) == "object")
          for(var i=keys.length-1; i >= 0; i--)
          {
            key = keys[i];
            //print(i);
            if(obj == null)
            {
              //print('not obj');
              obj = {};
              obj[key] = rows[_key];
              tmp = JSON.parse(JSON.stringify(obj));
              //p(obj);
            }
            else
            {
              //print('obj');
              //p(tmp);
              obj = {};
              obj[key] = tmp;
              tmp = JSON.parse(JSON.stringify(obj));
              //p(obj);
            }
          }
        else
        {
          obj = {};
          obj[keys] = rows[_key];
        }
        //p(obj);
        //print(key);
        result = MergeRecursive(result, obj);
        //result[key] = obj[key];
      }
      //p(result);
      body = result;
    }
    this.cache[query] = body;
    return body;
  },

  /**
   * @param object the object to update on the server
   * (_id is mandatory, the server may need _rev for conflict management)
   * if the server features conflict management, the object is updated with _rev
   */
  Put : function(object) {
    var logger = Log4Moz.repository.getLogger("RESTDatabase.put");
    var url = this.baseUrl + object._id;
    var body;
    try{
      body = this.send("PUT", url, object);
      if(!body)
        throw Exception(JSON.stringify(body));
    }catch(e)
    {
      logger.error(url);
      logger.error(object);
      logger.error(e);
      throw e;
    }
    if(body.rev)
      object._rev = body.rev;
    return object;
  },

  /**
   * @param object the object to delete on the server
   * (_id is mandatory, the server may need _rev for conflict management)
   */
  Delete : function(object) {
    var logger = Log4Moz.repository.getLogger("RESTDatabase.delete");
    var url = this.baseUrl + object._id;
    if(object._rev)
      url += "?rev=" + object._rev;
    var body;
    try{
      body = this.send("DELETE", url, null);
      if(!body)
        throw Exception(JSON.stringify(body));
    }catch(e)
    {
      logger.error(url);
      logger.error(e);
      throw e;
    }
    return true;
  }
}