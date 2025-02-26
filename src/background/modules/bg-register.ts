import {
	createMpPage,
	deleteBookmarks,
	getShelfData,
	sendMpMsg,
} from './bg-popup';
import {
	sendAlertMsg,
	updateStorageAreaInBg,
} from './bg-utils';
import {
	bookIds,
	Config,
	mpTempData,
} from './bg-vars';
import { Wereader } from './bg-wereader-api';

export function initRegister() {
	// 监听消息
	chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
		console.log('background onMessage: ', msg);
		let tabId: number | undefined;
		if (sender && sender.tab) tabId = sender.tab.id;
		switch(msg.type){
			case "getShelf":
				getShelfData().then(data=>{
					sendResponse({data: data});
				});
				break;
			case "saveRegexpOptions"://保存直接关闭设置页时onchange未保存的信息
				updateStorageAreaInBg(msg.regexpSet);
				break;
			case "deleteBookmarks":
				if(!msg.confirm) return;
				deleteBookmarks(msg.isAll).then(deleteResp=>{
					const deleteMsg = `删除结束，${deleteResp.succ} 成功，${deleteResp.fail} 失败。请重新加载读书页。`;
					sendAlertMsg({icon: 'info', text: deleteMsg}, tabId).then(alertResp=>{
						// 弹窗通知失败后使用 alert()
						if(alertResp && !(alertResp as {succ: number}).succ) alert(deleteMsg);
					});
				});
			case 'fetch':
				if(!msg.url) return;
				fetch(msg.url, msg.init).then(resp=>{
					console.log('resp', resp);
					let contentType = msg.init.headers['content-type'];
					if(contentType === undefined || contentType === 'application/json')
						return resp.json();
					else if(contentType === 'text/plain')
						return resp.text();
				}).then(data=>{
					sendResponse({data: data});
				});
				break;
			case 'mploadmore':
				let index = msg.offset / 10;
				if(mpTempData[msg.bookId] && mpTempData[msg.bookId][index]){
					sendResponse({data: mpTempData[msg.bookId][index]});
					return true;
				}
				fetch(`https://i.weread.qq.com/book/articles?bookId=${msg.bookId}&count=10&offset=${msg.offset}`).then(resp=>{
					console.log('resp', resp);
					return resp.json();
				}).then(data=>{
					if(!mpTempData[msg.bookId]){
						mpTempData[msg.bookId] = [];
					}
					mpTempData[msg.bookId][index] = data;
					sendResponse({data: data});
				});
				break;
			case 'mpInit':
				sendResponse(sendMpMsg);
				break;
			case 'createMpPage': // message from shelf mp
				createMpPage(msg.bookId).then((resp)=>{
					sendResponse(resp);
				});
				break;
			case 'Wereader':
				let wereader = new Wereader();
				switch(msg.func){
					case 'shelfRemoveBook':
						wereader.shelfRemoveBook(msg.bookIds).then(resp=>{
							return resp.json();
						}).then(json=>{
							sendResponse({data: json, bookIds: msg.bookIds});
						});
						break;
					case 'shelfMakeBookPrivate':
						wereader.shelfMakeBookPrivate(msg.bookIds).then(resp=>{
							return resp.json();
						}).then(json=>{
							sendResponse({data: json, bookIds: msg.bookIds});
						});
						break;
					case 'shelfMakeBookPublic':
						wereader.shelfMakeBookPublic(msg.bookIds).then(resp=>{
							return resp.json();
						}).then(json=>{
							sendResponse({data: json, bookIds: msg.bookIds});
						});
						break;
				}
				break;
		}
		return true;
	});

	// 右键反馈
	chrome.contextMenus.create({
		"type":"normal",
		"title":"反馈",
		"contexts":["browser_action"],
		"onclick": ()=>{
			chrome.tabs.create({url: "https://github.com/Higurashi-kagome/wereader/issues/new/choose"});
		}
	})

	// 监听 storage 改变并相应更新 Config
	chrome.storage.onChanged.addListener(function(changes, namespace) {
		console.log(`new ${namespace} changes`, changes)
		// 更新 Config
		if(namespace !== 'sync') return;
		for(const key in changes){
			Config[key] = changes[key]['newValue'];
		}
	});

	// 监听读书页请求，由请求得到 bookId
	chrome.webRequest.onBeforeRequest.addListener(details => {
		const {tabId, url} = details;
		if(url.indexOf("bookmarklist?bookId=") < 0) return;
		const bookId = url.replace(/(^.*bookId=|&type=1)/g,"");
		bookIds.set(tabId, bookId);
	}, {urls: ["*://weread.qq.com/web/book/*"]});

	// 监听安装事件
	chrome.runtime.onInstalled.addListener(function(details){
		const onUpdated = false;
		const onInstall = false;
		if(details.reason === 'install' && onInstall){
			chrome.tabs.create({url: "https://github.com/Higurashi-kagome/wereader/issues/9"});
		} else if(details.reason === 'update' && onUpdated){
			chrome.notifications.create({
				title: '微信读书笔记助手',
				iconUrl: '/icons/icon128.png',
				message: '',
				type: 'basic'
			});
		}
	});
}