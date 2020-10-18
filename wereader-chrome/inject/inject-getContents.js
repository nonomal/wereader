/* 主要用于获取书本目录 */

//console.log("inject-getContents.js：被注入，开始获取目录");
var contentElement = document.getElementsByClassName("readerCatalog_list")[0];
try{
    var childs = contentElement.childNodes
    var texts = []
    for (var i = 0,len = childs.length; i < len; i++){
        var classname = childs[i].childNodes[0].className
        var level = classname.charAt(classname.length - 1)
        var innerHtml = childs[i].childNodes[0].childNodes[0].innerHTML
        texts.push(level + innerHtml)
        //顺便设置显示目录级别
        childs[i].title = "level" + level
    }
    var currentContent = ""
    if(document.getElementsByClassName("readerTopBar_title_chapter")[0]){
        currentContent = document.getElementsByClassName("readerTopBar_title_chapter")[0].innerHTML
    }else{
        currentContent = document.getElementsByClassName("chapterItem chapterItem_current")[0].childNodes[0].childNodes[0].innerHTML
    }
    //传消息给后台
    chrome.runtime.sendMessage({type: "getContents", contents: texts,currentContent:currentContent})
}catch{
    console.log("inject-getContents.js：获取目录失败")
}
