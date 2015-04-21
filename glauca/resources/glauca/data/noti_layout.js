'use strict';

let dict = {
  dm: '条新私信',
  comment: '条新评论',
  mention: '条新at',
  fans: '个新粉丝'
};

function clearNode(node) {
  while(node.firstChild) node.removeChild(node.firstChild);
  return node;
}

self.port.on('show', function(info) {
  for (let key in info) {
    clearNode(document.getElementById(key)).appendChild(document.createTextNode((info[key] || 0) + dict[key]));
  }
});