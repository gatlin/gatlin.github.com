module.exports = function anonymous(locals, attrs, escape, rethrow, merge) {
attrs = attrs || jade.attrs; escape = escape || jade.escape; rethrow = rethrow || jade.rethrow; merge = merge || jade.merge;
var buf = [];
with (locals || {}) {
var interp;
var __indent = [];
buf.push('<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">\n    <meta name="viewport" content="width=device-width" initial-scale="1.0">\n    <meta name="description" content="">\n    <meta name="author" content="">\n    <title ng-bind-template="{{pageTitle}}"></title>\n    <link rel="stylesheet" href="/css/app.css"><!--[if lte IE 7]>\n    <script src="http://cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js"></script><![endif]--><!--[if lte IE 8]>\n    <script src="//html5shiv.googlecode.com/svn/trunk/html5.js"></script><![endif]-->\n    <script>\n      window.brunch = window.brunch || {};\n      window.brunch[\'auto-reload\'] = {\n        enabled: true\n      };\n    </script>\n    <script src="/js/vendor.js"></script>\n    <script src="/js/app.js"></script>\n  </head>\n  <body ng-controller="AppCtrl">\n    <div class="wrapper">\n      <div class="navbar navbar-static-top">\n        <div class="navbar-inner">\n          <div class="container">\n            <button data-toggle="collapse" data-target=".nav-collapse" class="btn btn-navbar"><span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span></button><a href="/" class="brand">DNA Map</a>\n            <div class="nav-collapse">\n              <div ng-include="\'/partials/nav.html\'"></div>\n            </div>\n          </div>\n        </div>\n      </div>\n      <div class="container main-content">\n        <div ng-view></div>\n      </div>\n      <div class="push"></div>\n    </div>\n    <footer class="footer">\n      <div class="container">\n        <p><small><a href="https://github.com/scotch/angular-brunch-seed">angular-brunch-seed | source</a></small></p>\n      </div>\n    </footer>\n  </body>\n</html>');
}
return buf.join("");
};module.exports = function anonymous(locals, attrs, escape, rethrow, merge) {
attrs = attrs || jade.attrs; escape = escape || jade.escape; rethrow = rethrow || jade.rethrow; merge = merge || jade.merge;
var buf = [];
with (locals || {}) {
var interp;
var __indent = [];
buf.push('\n<div ng-app="ng-app">\n  <h2>The World, in vector format</h2>\n  <div ng-controller="MapCtrl">\n    <div class="row">\n      <div id="earth" worldmap="worldmap" class="span12"></div>\n    </div>\n  </div>\n</div>');
}
return buf.join("");
};module.exports = function anonymous(locals, attrs, escape, rethrow, merge) {
attrs = attrs || jade.attrs; escape = escape || jade.escape; rethrow = rethrow || jade.rethrow; merge = merge || jade.merge;
var buf = [];
with (locals || {}) {
var interp;
var __indent = [];
buf.push('\n<ul class="nav">\n  <li ng-class="getClass(\'/\')"><a ng-href="#/">map</a></li>\n</ul>');
}
return buf.join("");
};