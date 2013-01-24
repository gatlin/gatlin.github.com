'use strict';

var App;

App = angular.module('app', ['ngCookies', 'ngResource', 'app.controllers', 'app.directives', 'app.filters', 'app.services']);

App.config([
  '$routeProvider', '$locationProvider', function($routeProvider, $locationProvider, config) {
    $routeProvider.when('/', {
      templateUrl: '/partials/main.html'
    }).otherwise({
      redirectTo: '/'
    });
    return $locationProvider.html5Mode(false);
  }
]);

angular.element(document).ready(function() {
  return angular.bootstrap(document, ['app']);
});
'use strict';

/* Controllers
*/

angular.module('app.controllers', ['app.services']).controller('AppCtrl', [
  '$scope', '$location', '$resource', '$rootScope', function($scope, $location, $resource, $rootScope) {
    $scope.$location = $location;
    $scope.$watch('$location.path()', function(path) {
      return $scope.activeNavId = path || '/';
    });
    $scope.getClass = function(id) {
      if ($scope.activeNavId.substring(0, id.length) === id) {
        return 'active';
      } else {
        return '';
      }
    };
    $scope.getXY = function(lat, lon) {
      return {
        cx: lon * 2.6938 + 465.4,
        cy: lat * -2.6938 + 227.066
      };
    };
    return $scope.getLatLon = function(x, y) {
      return {
        lat: (y - 277.066) / -2.6938,
        lon: (x - 465.4) / 2.6938
      };
    };
  }
]).directive('worldmap', function() {
  return function(scope, element, attrs) {
    var id, paper, world;
    id = attrs.id;
    paper = Raphael(document.getElementById(id), 1000, 400);
    paper.rect(0, 0, 1000, 400, 10).attr({
      stroke: "none",
      fill: "0-#9bb7cb-#adc8da"
    });
    paper.setStart();
    angular.forEach(worldmap.shapes, function(v, k) {
      return paper.path(v).attr({
        "stroke": "#ccc6ae",
        "fill": "#f0efeb",
        "stroke-opacity": 0.25
      });
    });
    world = paper.setFinish();
    return world.hover(scope.over, scope.out);
  };
}).controller('MapCtrl', [
  '$scope', '$http', function($scope, $http) {
    $scope.over = function() {
      this.c = this.c || this.attr("fill");
      return this.stop().animate({
        fill: "#bacabd"
      }, 500);
    };
    $scope.out = function() {
      return this.stop().animate({
        fill: this.c
      }, 500);
    };
    return $http.get('/img/worldMap.svg').success(function(data) {
      return $scope.mapSVG = data;
    });
  }
]);
'use strict';

/* Directives
*/

angular.module('app.directives', ['app.services']).directive('appVersion', [
  'version', function(version) {
    return function(scope, elm, attrs) {
      return elm.text(version);
    };
  }
]);
'use strict';

/* Filters
*/

angular.module('app.filters', []).filter('interpolate', [
  'version', function(version) {
    return function(text) {
      return String(text).replace(/\%VERSION\%/mg, version);
    };
  }
]);
'use strict';

/* Sevices
*/

angular.module('app.services', []).factory('version', function() {
  return "0.1";
});
