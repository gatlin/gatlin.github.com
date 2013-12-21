'use strict';
angular.module('webApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize'
]).config([
  '$routeProvider',
  function ($routeProvider) {
    $routeProvider.when('/', {
      templateUrl: 'views/main.html',
      controller: 'MainCtrl'
    }).otherwise({ redirectTo: '/' });
  }
]);
'use strict';
angular.module('webApp').controller('MainCtrl', [
  '$scope',
  function ($scope) {
    $scope.rhcVars = [
      {
        label: 'Tablet',
        value: 0,
        industry: 2100,
        unit: '$'
      },
      {
        label: 'Peripherals & Accessories',
        value: 0,
        industry: 215,
        unit: '$'
      },
      {
        label: 'Software Costs',
        value: 0,
        industry: 400,
        unit: '$'
      },
      {
        label: 'Services',
        value: 0,
        industry: 500,
        unit: '$'
      },
      {
        label: 'Warranty / Extended Warranty Costs',
        value: 0,
        industry: 105,
        unit: '$'
      }
    ];
    $scope.nhcVars = [
      {
        label: 'Tablet',
        value: 0,
        industry: 685,
        unit: '$'
      },
      {
        label: 'Peripherals & Accessories',
        value: 0,
        industry: 325,
        unit: '$'
      },
      {
        label: 'Software Costs',
        value: 0,
        industry: 325,
        unit: '$'
      },
      {
        label: 'Services',
        value: 0,
        industry: 485,
        unit: '$'
      },
      {
        label: 'Warranty / Extended Warranty Costs',
        value: 0,
        industry: 230,
        unit: '$'
      }
    ];
    $scope.rscVars = [
      {
        label: 'Average Annual Failure Rate (HW)',
        value: 0,
        industry: '4 %',
        unit: '%'
      },
      {
        label: 'Average Productivity Loss Per Failure (minutes)',
        value: 0,
        industry: '78 min',
        unit: 'min'
      },
      {
        label: 'Hourly Mobile Employee FTE',
        value: 0,
        industry: '$33.00',
        unit: '$'
      },
      {
        label: 'Average IT Support Required per Downtime (minutes)',
        value: 0,
        industry: '53 min',
        unit: 'min'
      },
      {
        label: 'Hourly IT Support FTE',
        value: 0,
        industry: '$43.00',
        unit: '$'
      },
      {
        label: 'HW Failure Resulting in Replacement',
        value: 0,
        industry: '20%',
        unit: '%'
      },
      {
        label: 'HW Failure Not Covered by Warranty',
        value: 0,
        industry: '27%',
        unit: '%'
      }
    ];
    $scope.nscVars = [
      {
        label: 'Average Annual Failure Rate (HW)',
        value: 0,
        industry: '18.3%',
        unit: '%'
      },
      {
        label: 'Average Productivity Loss Per Failure (minutes)',
        value: 0,
        industry: '78 min',
        unit: 'min'
      },
      {
        label: 'Hourly Mobile Employee FTE',
        value: 0,
        industry: '$33.00',
        unit: '$'
      },
      {
        label: 'Average IT Support Required per Downtime (minutes)',
        value: 0,
        industry: '53 min',
        unit: 'min'
      },
      {
        label: 'Hourly IT Support FTE',
        value: 0,
        industry: '$43.00',
        unit: '$'
      },
      {
        label: 'HW Failure Resulting in Replacement',
        value: 0,
        industry: '45%',
        unit: '%'
      },
      {
        label: 'HW Failure Not Covered by Warranty',
        value: 0,
        industry: '58%',
        unit: '%'
      }
    ];
    $scope.fiveYearAll = function (vs, arc) {
      var t = 0;
      angular.forEach(vs, function (v, k) {
        t = t + $scope.fiveYearTCO(v.value, arc);
      });
      console.log(t);
      return t;
    };
    $scope.totalIDM = function (vars, fn) {
      var total = 0;
      angular.forEach(vars, function (v, k) {
        if (v) {
          if (fn) {
            v = fn(v);
          }
          total = total + parseFloat(v.value);
        }
      });
      return total;
    };
    $scope.fiveYearTCO = function (v, arc) {
      return v && arc ? v * (5 / arc) : parseFloat(0);
    };
    $scope.prodLossHWFail = function (vs) {
      return vs[0].value * 240 / 100 * vs[1].value / 60 * vs[2].value;
    };
    $scope.itSupportHWDown = function (vs) {
      return vs[0].value * 240 / 100 * vs[3].value / 60 * vs[4].value;
    };
    $scope.avgReplCost = function (vs1, vs2, arc) {
      return vs1[0].value * vs1[5].value / 100 * vs2[0].value;
    };
    $scope.totalOpCosts = function (vs, ws, arc) {
      return $scope.avgReplCost(vs, ws, arc) + $scope.itSupportHWDown(vs) + $scope.prodLossHWFail(vs);
    };
    $scope.tco5 = function (vs, ws, arc) {
      return $scope.fiveYearAll(ws, arc) + $scope.totalOpCosts(vs, ws, arc) * 5;
    };
    $scope.savings = function () {
      var r = $scope.tco5($scope.rscVars, $scope.rhcVars, $scope.rARC) / 5;
      var n = $scope.tco5($scope.nscVars, $scope.nhcVars, $scope.nARC) / 5;
      if (r && n) {
        return (n - r) / r * 100;
      } else {
        return 0;
      }
    };
    $scope.softRange1 = [
      0,
      1,
      2
    ];
    $scope.softRange2 = [
      3,
      4
    ];
    $scope.softRange3 = [
      5,
      6
    ];
  }
]);