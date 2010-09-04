var jsHighLighter = {
  fragments: null,
  
  getColorOverlay: function(fragments)
  {
    fragments = [{startPos:100, endPos: 200, bgColor:"#FF0000"}, 
    {startPos:150, endPos: 250, bgColor:"#0000FF"}, 
    {startPos:350, endPos: 400, bgColor:"#80FF00"}, 
    {startPos:380, endPos: 460, bgColor:"#FF80FF"}, 
    {startPos:400, endPos: 450, bgColor:"#FFFF00"}, 
    {startPos:500, endPos: 1000, bgColor:"#BEBEBE"}];

    return fragments;  
  },
  
  // Get TreeWalker Object
  getTreeWalker : function()
  {
    var m_Window = getRecentWindow();
    var m_gBrowser = m_Window.getBrowser();
    var m_document = m_gBrowser.contentDocument;
    
    try{
      var treewalker = m_document.createTreeWalker(m_document.body, 
      NodeFilter.SHOW_TEXT, 
      { acceptNode: function(node) 
        { 
          // only get text content
          if(node.nodeType != 3 || node.data.length == 0)
            return NodeFilter.FILTER_REJECT;
          
          // Filter the <script> content
          var m_parent = node.parentNode;
          if(m_parent && m_parent.tagName == "SCRIPT")
            return NodeFilter.FILTER_REJECT;
            
          return NodeFilter.FILTER_ACCEPT; 
        } 
      },
      false);
      return treewalker;
    }catch(e){
      return null;
    }
  },
  
  displayHighlighter: function(fragments)
  {
    this.fragments = fragments;
    if(fragments == null) return;
    setTimeout('jsHighLighter.doHighlight()', 500);    
  },
  
  doHighlight: function(fragments)
  {
    fragments = (fragments) ? fragments : this.fragments;
    //var_dump("[highlighter.js] doHighlight::fragments:", fragments, 4);
    
    var coordinates = [];
    for(var i=0, fragment; fragment = fragments[i]; i++)
    {
      coordinates.push(fragment.startPos);
      coordinates.push(fragment.endPos);
    }
    
    coordinates = coordinates.unique();
    coordinates.sort(function(a,b){return a - b});
    //var_dump("[highlighter.js] doHighlight::coordinates", coordinates, 4);
    
    if(coordinates.length == 0) return;
    
    var m_Window = getRecentWindow();
    var m_gBrowser = m_Window.getBrowser();
    var m_document = m_gBrowser.contentDocument;
    
    var treewalker = this.getTreeWalker();
    if(!treewalker) return;
    
    var startPos = 0, endPos;
    var nodeList = [];
    while(treewalker.nextNode())
    {
      if(startPos > coordinates[coordinates.length -1])
      {
        //var_dump("[highlighter.js] doHighlight::startPos", startPos, 4);
        //var_dump("[highlighter.js] doHighlight::coordinates[coordinates.length -1]", coordinates[coordinates.length -1], 4);
        break;
      }   
      var node = treewalker.currentNode;
      var m_parent = node.parentNode;
      var m_text = node.data;
      endPos = startPos + m_text.length;
      if(endPos < coordinates[0])
      {
        startPos = endPos;
        continue;
      } 
      
      //var_dump("[highlight.js]doHighlight()::node.tagName", node.tagName, 4);
      //var_dump("[highlight.js]doHighlight()::m_parent.tagName", m_parent.tagName, 4);
      //var_dump("[highlight.js]doHighlight()::startPos", startPos, 4);
      //var_dump("[highlight.js]doHighlight()::endPos", endPos, 4);
        
      var xPos = [];
      xPos.push(startPos);
      xPos.push(endPos);
      for(var i=0, pos; pos = coordinates[i]; i++)
        if(pos >= startPos && pos < endPos)
          xPos.push(pos);

      xPos = xPos.unique();
      xPos.sort(function(a,b){return a - b});
      //var_dump("[highlighter.js] doHighlight::xPos", xPos, 4);
        
      var needToBeReplaced = false;
      var rNode = m_document.createElement("span");
      for(var i=0; i < xPos.length-1; i++)
      {
        var absStartPos = xPos[i] - startPos;
        var absEndPos = xPos[i+1] - startPos;
        
        var bgColor = null;
        var cssClasses = LASULICLASS;
        for(var j=0, fragment; fragment = fragments[j]; j++)
          if(xPos[i] >= fragment.startPos && 
              xPos[i] < fragment.endPos)
          {
            var cssClass = LASULIHTCLASS + "_" + fragment.startPos + "_" + fragment.endPos;
            bgColor = (bgColor) ? colorUtil.colorCalc(bgColor, fragment.color) : fragment.color;
            cssClasses +=  " " + cssClass;
          }
          
        var subText = m_text.substring(absStartPos, absEndPos);
        //if(bgColor)
        //  var_dump("[highlighter.js] doHighlight::subText", bgColor + " [" + xPos[i] + "," + xPos[i+1] + ") " + subText, 4);
        
        var aNode = m_document.createElement("span");
        m_textNode = m_document.createTextNode(subText);
        aNode.appendChild(m_textNode);
        aNode.setAttribute("class",cssClasses);
        
        if(bgColor)
        {
          needToBeReplaced = true;
          aNode.setAttribute("style", "background-color: "+ bgColor);
          aNode.setAttribute("id", LASULIHTCLASS + xPos[i]);
        }

        rNode.appendChild(aNode);
      }

      if(needToBeReplaced)
          nodeList.push({originalNode: node, newNode: rNode});

      startPos = endPos;
    }
    
    //var_dump("[highlighter.js] doHighlight::nodeList", nodeList.length, 4);
    for(var i=0, nl; nl = nodeList[i]; i++)
      nl.originalNode.parentNode.replaceChild(nl.newNode, nl.originalNode);
  },
  
  removeHighlighter: function()
  {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
           .getService(Components.interfaces.nsIWindowMediator);
    for (var index = 0, tabbrowser = wm.getEnumerator('navigator:browser').getNext().getBrowser();
       index < tabbrowser.mTabs.length; index++) 
    {
      var m_gBrowser = tabbrowser.getBrowserAtIndex(index);
      var m_document = m_gBrowser.contentDocument;
      var nodes = m_document.querySelectorAll("span." + LASULICLASS);
      for(var i = 0, node; node = nodes[i]; i++)
      {
        var p_node = node.parentNode;
        if(p_node)
        {
          var m_textNode = m_document.createTextNode(node.textContent);
          p_node.replaceChild(m_textNode, node);
        }
      }
    }
  },
  
  getSelectionPos: function()
  {
    var fragment = {};
    var m_Window = getRecentWindow();
    var m_gBrowser = m_Window.getBrowser();
    var m_window = m_gBrowser.contentWindow;
    var selection = m_window.getSelection();
    var strContent = selection + "";
    strContent = strContent.trim();
    if(strContent == ""){
      alert("Please select a fragment!");
      return false;
    }
    var range = selection.getRangeAt(0);
    var startContainer = range.startContainer;
    var endContainer = range.endContainer;
    var startOffset = range.startOffset;
    var endOffset = range.endOffset;
    
    //debug("start:" + startContainer.nodeType);
    //debug("start:" + startContainer.data);
    //debug("start offset:" + startOffset);
    var treewalker = this.getTreeWalker();
    var curPos = 0;
    while(treewalker.nextNode())
    {
        var node = treewalker.currentNode;
        if(node.isSameNode(startContainer))
        {
          fragment.startPos = curPos + startOffset;
          //debug("found start pos:" + fragment.startPos);
        }
        if(node.isSameNode(endContainer))
        {
          fragment.endPos = curPos + endOffset;
          //debug("found end pos:" + fragment.endPos);
        }
          
        curPos += node.data.length;
    }
    if(strContent.length > 480) strContent = strContent.substring(0,477) + "...";
    fragment.content = strContent;
    if(typeof(fragment.startPos) == "undefined"
      || typeof(fragment.endPos) == "undefined")
      return false;
      
    return fragment;
  }
}