/* 说明：
util.js 是从 background.js 分离出来的，这里的所有函数最初都放在 background.js 中被调用。
现在之所以单独放在这个文件中纯粹是为了缩减 background.js 的代码量，从而使结构清晰
*/

//排序
var colId = "range"
var rank = function (x, y) {
	return (x[colId] > y[colId]) ? 1 : -1
}

//报错捕捉函数
function catchErr(sender) {
	if (chrome.runtime.lastError) {
		console.log(sender + " => chrome.runtime.lastError：\n" + chrome.runtime.lastError.message)
		return true
	}else{
		return false
	}
}

function getRangeArrFrom(strRange, str){
	let rangeArr = []
	if(/\[插图\]/.test(str)){
		let arr = str.split(/(?=\[插图\])|(?<=\[插图\])/)
		let lenCount = 0
		for (const item of arr) {
			if(item!='[插图]'){
				lenCount += item.length
			}else{
				rangeArr.push(parseInt(strRange+lenCount))
				lenCount += 4
			}
		}
	}
	return rangeArr
}

//更新sync和local——处理设置页onchange不生效的问题
function updateStorageAreainBg(configMsg={},callback=function(){}){
	//存在异步问题，故设置用于处理短时间内需要进行多次设置的情况
	if(configMsg.key != undefined){
        let config = {}
        let key = configMsg.key
        let value = configMsg.value
        config[key] = value
        chrome.storage.sync.set(config,function(){
            if(catchErr("bg.updateSyncAndLocal"))alert(StorageErrorMsg)
            chrome.storage.local.get(function(settings){
                const currentProfile = configMsg.currentProfile
                settings[BackupKey][currentProfile][key] = value
                chrome.storage.local.set(settings,function(){
					if(catchErr("bg.updateSyncAndLocal"))alert(StorageErrorMsg)
                    callback()
                })
            })
        })
    }
}

//存储 / 初始化设置
function settingInitialize() {
	chrome.storage.sync.get(function (setting) {
		/* 初始化选项 */
		for(let key in Config){
			//这里必须判断是否为 undefined，因为 false 属于正常值
			if(setting[key] == undefined){
				setting[key] = Config[key]
			}else{
				Config[key] = setting[key]
			}
		}
		//存储到 sync
		chrome.storage.sync.set(setting,function(){
			if(catchErr("settingInitialize"))alert(StorageErrorMsg)
		})
		/* 检查本地 storage */
		chrome.storage.local.get([BackupKey], function(localSetting) {
			const defaultBackupName = "默认设置"
			setting.backupName = undefined
			if(localSetting[BackupKey] == undefined){//无备份
				localSetting[BackupKey] = {}
				localSetting[BackupKey][defaultBackupName] = setting
			}else if(localSetting[BackupKey][defaultBackupName] == undefined){//无默认备份
				localSetting[BackupKey][defaultBackupName] = setting
			}
			chrome.storage.local.set(localSetting,function(){
				if(catchErr("settingInitialize"))alert(StorageErrorMsg)
			})
		})
	})
}

//发送消息到content.js
function sendMessageToContentScript(message,id) {
	if(id != undefined){
		chrome.tabs.sendMessage(id, message)
	}else{
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if(tabs[0].id != undefined){
				chrome.tabs.sendMessage(tabs[0].id, message)
			}
		})
	}
}

//通知函数
function sendAlertMsg(msg) {
	sendMessageToContentScript({isAlertMsg: true, alertMsg: msg})
}

//复制内容
function copy(text) {
	//添加这个变量是因为发现存在一次复制成功激活多次 clipboard.on('success', function (e) {})的现象
	var count = 0;
	var inputText = document.getElementById("formatted_text");
	var copyBtn = document.getElementById("btn_copy");
	var clipboard = new ClipboardJS('.btn');
	clipboard.on('success', function (e) {
		if(count == 0){//进行检查而确保一次复制成功只调用一次sendAlertMsg()
			sendAlertMsg({icon: 'success',title: 'Copied successfully'});
			count = count + 1;
		}
	});
	clipboard.on('error', function (e) {
		sendAlertMsg({title: "复制出错", text: JSON.stringify(e), confirmButtonText: '确定',icon: "error"});
	});
	inputText.innerHTML = text;
	copyBtn.click();
}

//获取数据
function getData(url, callback) {
	var httpRequest = new XMLHttpRequest();
	httpRequest.open('GET', url, true);
	httpRequest.withCredentials = true;
	try{
		httpRequest.send();
	}catch(err){
		sendAlertMsg({text: "似乎没有联网", icon: "warning"})
	}
	httpRequest.onreadystatechange = function () {
		if (httpRequest.readyState == 4 && httpRequest.status == 200) {
			var data = httpRequest.responseText;//获取到json字符串，还需解析
			callback(data);
		}else if(httpRequest.readyState == 4 && (httpRequest.status == 400 || httpRequest.status == 401 || httpRequest.status == 403 || httpRequest.status == 404 || httpRequest.status == 500)){
			sendAlertMsg({title: "获取失败:", text: JSON.stringify(httpRequest.responseText), icon: "error",confirmButtonText: '确定'})
		}
	};
}

//获取添加级别的标题
function getTitleAddedPre(title, level) {
	//添加4 5 6级是为了处理特别的书（如导入的书籍）获取数据
	var lev3 = Config["lev3"]
	var leave = 6 - (lev3.split("#").length - 1)
	var chars = new Array(leave).join("#")
	return (level == 1) ? (Config["lev1"] + title)
		: (level == 2) ? (Config["lev2"] + title)
		: (level == 3) ? (lev3 + title)
		: (level == 4) ? (("#".length <= level ? "#" : chars) + lev3 + title)
		: (level == 5) ? (("##".length <= level ? "##" : chars) + lev3 + title)
		: (level == 6) ? (("###".length <= level ? "###" : chars) + lev3 + title)
		: (("###".length <= level ? "###" : chars) + lev3 + title)
}

//根据标注类型获取前后缀
function addPreAndSuf(markText,style){

	pre = (style == 0) ? Config["s1Pre"]
	: (style == 1) ? Config["s2Pre"]
	: (style == 2) ? Config["s3Pre"]
	: ""

	suf = (style == 0) ? Config["s1Suf"]
	: (style == 1) ? Config["s2Suf"]
	: (style == 2) ? Config["s3Suf"]
	: ""
	
	return pre + markText + suf
}

//给 markText 进行正则匹配
function getRegExpMarkText(markText,regexpCollection){
	for(let n=0;n<regexpCollection.length;n++){
		let pattern = regexpCollection[n][1]
		let re = new RegExp(pattern)
		if(re.test(markText)){
			markText = regexpCollection[n][2] + markText + regexpCollection[n][3]
			break
		}
	}
	return markText
}

function addThoughts(chaptersAndMarks,contents,callback){
	getMyThought(function(thoughts) {
		//遍历章节
		for(let chapterUid in thoughts){
			//遍历章节依次将各章节章内想法添加进 marks
			let addedToMarks = false
			for(let i=0;i<chaptersAndMarks.length;i++){
				//找到目标章节
				if(chaptersAndMarks[i].chapterUid == parseInt(chapterUid)){
					//想法与标注合并后按 range 排序
					colId = "range"
					chaptersAndMarks[i].marks = chaptersAndMarks[i].marks.concat(thoughts[chapterUid]).sort(rank)
					addedToMarks = true
					//遍历章内想法获取'[插图]'索引
					let rangeArr = chaptersAndMarks[i].rangeArr
					for (const thought of thoughts[chapterUid]) {
						rangeArr = rangeArr.concat(getRangeArrFrom(thought.range, thought.abstract))
					}
					chaptersAndMarks[i].rangeArr = rangeArr
					break
				}
			}
			//如果想法未被成功添加进标注（想法所在章节不存在标注的情况下发生）
			if(!addedToMarks){
				let chapter = {}
				chapter.chapterUid = parseInt(chapterUid)
				chapter.title = contents[parseInt(chapterUid)].title
				chapter.marks = thoughts[chapterUid]
				chaptersAndMarks.push(chapter)
			}
		}
		//按章节排序
		colId = "chapterUid"
		chaptersAndMarks.sort(rank)
		callback(chaptersAndMarks)
	})
}

//获取目录
function getContents(callback){
	const url = `https://i.weread.qq.com/book/chapterInfos?bookIds=${bookId}&synckeys=0`
	getData(url, function (data) {
		//得到目录
		let contentData = JSON.parse(data).data[0].updated
		let contents = {}
		for (let i = 0; i < contentData.length; i++) {
			contents[contentData[i].chapterUid] = { title: contentData[i].title, level: parseInt(contentData[i].level) }
		}
		callback(contents)
	})
}

//获取章内标注
function traverseMarks(marks,all,indexArr){
	var res = ""
	var index = 0
	for (let j = 0; j < marks.length; j++) {//遍历章内标注
		let abstract = marks[j].abstract
		let markText = abstract ? abstract : marks[j].markText
		//只获取本章时"[插图]"转图片、注释或代码块
		while(!all && /\[插图\]/.test(markText)){
			let amarkedData = markedData[indexArr[index]]
			if(!amarkedData){//数组越界
				console.log(JSON.stringify(markedData))
				console.log(markText)
				sendAlertMsg({title: "图片获取出错，建议反馈", text: JSON.stringify(markedData), confirmButtonText: '确定',icon: "error"})
				return ''
			}
			let replacement = ''
			if(amarkedData.src){//图片
				//非行内图片单独占行（即使它与文字一起标注）
				let inser1 = '', inser2 = ''
				//不为行内图片且'[插图]'前有内容
				if(!amarkedData.isInlineImg && markText.indexOf('[插图]') > 0)
					inser1 = '\n\n'
				//不为行内图片且'[插图]'后有内容
				if(!amarkedData.isInlineImg && markText.indexOf('[插图]') != (markText.length - 4))
					inser2 = '\n\n'
				replacement = `${inser1}![${amarkedData.alt}](${amarkedData.src})${inser2}`
			}else if(amarkedData.footnote){//注释
				replacement = `[^${amarkedData.name}]`
			}else if(amarkedData.code){//代码块
				let inser1 = '', inser2 = ''
				//'[插图]'前有内容
				if(markText.indexOf('[插图]') > 0)
					inser1 = '\n\n'
				//'[插图]'后有内容
				if(markText.indexOf('[插图]') != (markText.length - 4))
					inser2 = '\n\n'
				replacement = `${inser1}${Config.codePre}\n${amarkedData.code}${Config.codeSuf}${inser2}`
			}
			markText = markText.replace(/\[插图\]/, replacement)
			index = index + 1
		}
		
		if(abstract){//如果为想法，则添加前后缀
			markText = `${Config.thouMarkPre}${markText}${Config.thouMarkSuf}`
		}else{//不是想法（为标注）则进行正则匹配
			markText = getRegExpMarkText(markText,Config.checkedRe)
		}
		res += `${addPreAndSuf(markText,marks[j].style)}\n\n`
		if(abstract){//需要添加想法时，添加想法
			let content = marks[j].content
			res += `${Config.thouPre}${content}${Config.thouSuf}\n\n`
		}
	}
	if(!all){//只在获取本章时添加注脚
		for(let i=0;i<markedData.length;i++){
			if(markedData[i].footnote){
				res += `[^${markedData[i].name}]:${markedData[i].footnote}\n\n`
			}
		}
	}
	return res
}

//右键反馈
chrome.contextMenus.create({
    "type":"normal",
    "title":"反馈",
    "contexts":["browser_action"],
    "onclick":function() {
        chrome.tabs.create({url: "https://github.com/Higurashi-kagome/wereader/issues/new/choose"})
    }
})

//监听背景页所需storage键值是否有改变
chrome.storage.onChanged.addListener(function(changes, namespace) {
	console.log('new changes：')
	console.log(changes)
	if(namespace == "sync"){
		chrome.storage.sync.get(function(setting){
			let uselessKeys = []
			for(let key in setting){
				//删除本不该存在的键
				if(syncConfigTemplate[key] == undefined){
					uselessKeys.push(key)
					continue
				}
				//更新 Config
				Config[key] = setting[key]
			}
			chrome.storage.sync.remove(uselessKeys,function(){
				if(catchErr("storage.onChanged"))alert(StorageErrorMsg)
			})
		})

		chrome.storage.local.get(function(settings){
			for(let name in settings[BackupKey]){
				//删除本不该存在的键
				for(let key in settings[BackupKey][name]){
					if(backupTemplate[key] == undefined){
						delete settings[BackupKey][name][key]
					}
				}
			}
			//todo
			/* chrome.storage.local.set(settings,function(){
				if(catchErr("storage.onChanged"))alert(background_storageErrorMsg)
				else console.log("onChanged.addListener updated local：")
				console.log(settings)
			}) */
		})
	}
})

//监听请求用于获取导入书籍的bookId
chrome.webRequest.onBeforeRequest.addListener(details => {
	let url = details.url
	if(url.indexOf("bookmarklist?bookId=") > -1) {
		let bookId = url.replace(/(^[\S\s]*bookId=|&type=1)/g,"")
		if(!/^\d+$/.test(bookId)){//如果bookId不为整数（说明该书为导入书籍）
			importBookId = bookId
			//在内部重新注入脚本以重新获取bid
			chrome.tabs.executeScript({ file: 'inject/inject-bid.js' }, function (result) {
				catchErr("chrome.webRequest.onBeforeRequest.addListener()")
			})
		}
	}
}, {urls: ["*://weread.qq.com/web/book/*"]})

//安装事件
chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
        chrome.tabs.create({url: "https://github.com/Higurashi-kagome/wereader/issues/9"})
    }
})