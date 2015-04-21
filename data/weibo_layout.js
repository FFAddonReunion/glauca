'use strict';

let parser = new DOMParser();
function generateRichText(text) {
  text = text.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  text = '<span>' + text.replace(/(\#[^\#]+\#)/g, function(match){
    return '<a target="_blank" class="tweet-link" href="http://weibo.com/k/' + match.substring(1, match.length - 1) + '">' + match + '</a>';
  }).replace(/(\@[\u4e00-\u9fa5A-Za-z0-9_-]+)/g, function(match){
    return '<a target="_blank" class="tweet-link" href="http://weibo.com/n/' + match.substring(1) + '">' + match + '</a>';
  }).replace(/(http:\/\/t.cn\/[\w]+)/ig, function(match){
    return '<a target="_blank" class="tweet-link" href="' + match + '">' + match + '</a>';
  }) + '</span>';/*.replace(/(\[[^\]]+\])/g,function(match){
     var index=glauca.sina.emotions.emotionBase.tags.indexOf(match);
     if(index!=-1){
       return "<html: img src='"+glauca.sina.emotions.emotionBase.urls[index]+"' width='20px' height='20px'/>";
     }
     else return match;
   });
   return "<html: p>"+t+"</html: p>";
  }*/
  return parser.parseFromString(text, 'text/html').body.firstChild;
}

function generateImageNodes(data, image) {
  if (data.pic_urls && data.pic_urls.length > 0) {
    let multiple = (data.pic_urls.length > 1);
    if (multiple) image.setAttribute('class', image.getAttribute('class') + ' multiple');
    data.pic_urls.forEach(function(item) {
      let thumb = item.thumbnail_pic;
      let target = thumb.replace('thumbnail', 'large');
      if (multiple) thumb = thumb.replace('thumbnail', 'square');
      image.appendChild(
        parser.parseFromString('<a class="tweet-image-item" target="_blank" href="' + target + '">' +
          '<img src="' + thumb + '">' +
        '</a>', 'text/html').body.firstChild);
    });
  }
}

function clearNode(node) {
  while(node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let $ = document.body.querySelector.bind(document.body);
let currentId = null, currentData;
self.port.on('show', function(data, index) {
  if (!data) return;
  currentId = data.id;
  $('.avatar').href = 'http://weibo.com/n/' + data.user.screen_name;
  $('.avatar-img').src = data.user.profile_image_url;
  clearNode($('.nickname')).appendChild(document.createTextNode(data.user.screen_name));
  clearNode($('.tweet-text')).appendChild(generateRichText(data.text).firstChild);
  let image = $('.tweet-image');
  image.setAttribute('class', 'tweet-image');
  clearNode(image);
  generateImageNodes(data, image);
  let retweetNode = $('.retweet-body');
  if (data.retweeted_status) {
    let s = data.retweeted_status;
    retweetNode.style.display = 'block';
    clearNode($('.retweet-text')).appendChild(generateRichText(s.text).firstChild);
    $('.retweet-avatar').href = 'http://weibo.com/n/' + s.user.screen_name;
    $('.retweet-avatar-img').src = s.user.profile_image_url;
    clearNode($('.retweet-nickname')).appendChild(document.createTextNode(s.user.screen_name));
    image = $('.retweet-image');
    image.setAttribute('class', 'retweet-image');
    clearNode(image);
    generateImageNodes(s, image);
  } else {
    retweetNode.style.display = 'none';
  }

  let likeButton = $('.toolbar-item.like');
  if (data.liked) likeButton.setAttribute('class', 'toolbar-item like liked');
  else likeButton.setAttribute('class', 'toolbar-item like');
  let favButton = $('.toolbar-item.fav');
  if (data.favorited) favButton.setAttribute('class', 'toolbar-item fav faved');
  else favButton.setAttribute('class', 'toolbar-item fav');

  let date = new Date(data.created_at);
  let timeNode = $('.time');
  let currentDate = new Date();
  let text;
  if(Date.now() - date.getTime() < 60000){//in a minute
    text = parseInt((Date.now() - date.getTime()) / 1000) + '秒前';
  } else if(Date.now() - date.getTime() < 3600000){//in 1 hour
    text = parseInt((Date.now() - date.getTime()) / 60000) + '分钟前';
  } else if(Date.now()-date.getTime() < 10800000){//in 3 hours
    text = parseInt((Date.now() - date.getTime()) / 3600000) + '小时前';
  } else if(
    currentDate.getMonth() === date.getMonth() &&
    currentDate.getYear() === date.getYear() &&
    currentDate.getDate() - date.getDate() < 3) {
    let day = '';
    let ex = currentDate.getDate() - date.getDate();
    if (ex === 0) day = '今天';
    else if (ex === 1) day = '昨天';
    else if (ex === 2) day = '前天';
    text = day + ' ' + date.toLocaleTimeString();
  } else text = date.toLocaleDateString();
  clearNode(timeNode).appendChild(document.createTextNode(text));
  clearNode($('.from')).appendChild(document.createTextNode(data.source !== '' ? data.source.match(/\<a.*?\>(.*?)\<\/a\>/)[1] : ''));
  clearNode($('.index')).appendChild(document.createTextNode((index.index + 1) + '/' + index.total));
  currentData = data;
});

//bind event handlers
let commentBox = $('.comment-box'), mask = $('.mask');
function emitMessage(type, value) {
  self.port.emit('post', {
    type: type,
    id: currentId,
    value: value
  });
}
function hideCommentBox() {
  commentBox.setAttribute('class', 'comment-box');
  mask.setAttribute('class', 'mask');
  $('.button.submit').onclick = undefined;
}
function submitComment(type) {
  let value = $('.comment-area').value;
  emitMessage(type, value);
  hideCommentBox();
}
function showCommentBox(type) {
  commentBox.setAttribute('class', 'comment-box open');
  mask.setAttribute('class', 'mask open');
  $('.button.submit').onclick = submitComment.bind(null, type);
}
function likeButtonClickHandler() {
  currentData.liked = !currentData.liked;
  let likeButton = $('.toolbar-item.like');
  if (currentData.liked) likeButton.setAttribute('class', 'toolbar-item like liked');
  else likeButton.setAttribute('class', 'toolbar-item like');
  emitMessage('like', currentData.liked);
}

function favButtonClickHandler() {
  let favButton = $('.toolbar-item.fav');
  if (currentData.favorited) favButton.setAttribute('class', 'toolbar-item fav faved');
  else favButton.setAttribute('class', 'toolbar-item fav');
  emitMessage('fav', !currentData.favorited);
}
$('.comment').addEventListener('click', showCommentBox.bind(null, 'comment'));
$('.retweet').addEventListener('click', showCommentBox.bind(null, 'retweet'));
$('.fav').addEventListener('click', emitMessage.bind(null, 'fav'));
$('.like').addEventListener('click', likeButtonClickHandler);
$('.fav').addEventListener('click', favButtonClickHandler);
$('.prev').addEventListener('click', function() {
  self.port.emit('show', 'prev');
});
$('.next').addEventListener('click', function() {
  self.port.emit('show', 'next');
});
$('.nickname').addEventListener('click', function() {
  self.port.emit('show', 'web');
  return false;
});
$('.button.cancel').addEventListener('click', hideCommentBox);
$('.mask').addEventListener('click', hideCommentBox);
