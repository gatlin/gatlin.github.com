module.exports = function anonymous(locals,attrs,escape,rethrow,merge){attrs=attrs || jade.attrs;escape=escape || jade.escape;rethrow=rethrow || jade.rethrow;merge=merge || jade.merge;var buf=[];with (locals ||{}){var interp;var __indent=[];buf.push('<!DOCTYPE html>\n<html lang="en" ng-app="app">\n <head>\n <meta charset="utf-8">\n <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">\n <meta name="viewport" content="width=device-width" initial-scale="1.0">\n <meta name="description" content="">\n <meta name="author" content="">\n <title ng-bind-template="{{pageTitle}}"></title>\n <link rel="stylesheet" href="/css/app.css"><!--[if lte IE 7]>\n <script src="http://cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js"></script><![endif]--><!--[if lte IE 8]>\n <script src="//html5shiv.googlecode.com/svn/trunk/html5.js"></script><![endif]-->\n <script>\n window.brunch = window.brunch ||{};\n window.brunch[\'auto-reload\'] ={\n enabled:true\n};\n </script>\n <script src="/js/vendor.js"></script>\n <script src="/js/app.js"></script>\n </head>\n <body ng-controller="AppCtrl">\n <div class="wrapper">\n <div class="navbar navbar-static-top">\n <div class="navbar-inner">\n <div class="container-fluid">\n <button data-toggle="collapse" data-target=".nav-collapse" class="btn btn-navbar"><span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span></button><a href="/" class="brand">Coauthor</a>\n <div class="nav-collapse">\n <div ng-include="\'/partials/nav.html\'"></div>\n </div>\n </div>\n </div>\n </div>\n <div class="container-fluid main-content">\n <div ng-view></div>\n </div>\n <div class="push"></div>\n </div>\n <footer class="footer">\n <div class="container">\n <p><small>Coauthor is a simple,collaborative wiki.</small></p>\n </div>\n </footer>\n </body>\n</html>')}return buf.join("")};module.exports = function anonymous(locals,attrs,escape,rethrow,merge){attrs=attrs || jade.attrs;escape=escape || jade.escape;rethrow=rethrow || jade.rethrow;merge=merge || jade.merge;var buf=[];with (locals ||{}){var interp;var __indent=[];buf.push('\n<div ng-app="ng-app">\n <div ng-controller="EditCtrl">\n <div id="main" class="row-fluid"></div>\n <div class="row-fluid">\n <div class="span2">\n <ul class="nav nav-pills nav-stacked">\n <li class="nav-header">Site</li>\n <li><a ng-href="#/p/home">Front Page</a></li>\n <li><a href="#">All Pages</a></li>\n <li><a href="#">Categories</a></li>\n <li><a href="#">Upload a file</a></li>\n <li class="nav-header">Page</li>\n <li><a ng-href="#/p/{{pageId}}">View the page</a></li>\n </ul>\n </div>\n <div id="thearea" class="span9 clearfix">\n <textarea ng-model="content" ui-jq="wysihtml5" editable="editable" id="editor" class="editable"></textarea>\n </div>\n </div>\n </div>\n</div>')}return buf.join("")};module.exports = function anonymous(locals,attrs,escape,rethrow,merge){attrs=attrs || jade.attrs;escape=escape || jade.escape;rethrow=rethrow || jade.rethrow;merge=merge || jade.merge;var buf=[];with (locals ||{}){var interp;var __indent=[];buf.push('\n<ul class="nav"></ul>')}return buf.join("")};module.exports = function anonymous(locals,attrs,escape,rethrow,merge){attrs=attrs || jade.attrs;escape=escape || jade.escape;rethrow=rethrow || jade.rethrow;merge=merge || jade.merge;var buf=[];with (locals ||{}){var interp;var __indent=[];buf.push('\n<div ng-app="ng-app">\n <div ng-controller="PageCtrl">\n <div id="main" class="row-fluid"></div>\n <div class="row-fluid">\n <div class="span2">\n <ul class="nav nav-pills nav-stacked">\n <li class="nav-header">Site</li>\n <li><a ng-href="#/p/home">Front Page</a></li>\n <li><a href="#">All Pages</a></li>\n <li><a href="#">Categories</a></li>\n <li><a href="#">Upload a file</a></li>\n <li class="nav-header">Page</li>\n <li><a ng-href="#/e/{{pageId}}">Edit the page</a></li>\n </ul>\n </div>\n <div id="thearea" ng-bind-html-unsafe="content" class="span9 clearfix"></div>\n </div>\n </div>\n</div>')}return buf.join("")};