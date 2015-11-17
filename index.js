var async = require('queue-async');
var AWS = require('aws-sdk');
var Joi = require('joi');

var schemas = {
  metric: Joi.object().keys({
    metricName: Joi.string().required(),
    namespace: Joi.string().required(),
    statistic: Joi.string().regex(/(SampleCount|Average|Sum|Minimum|Maximum)/).required(),
    dimensionName: Joi.string().required(),
    dimensionValue: Joi.string().required()
  }),
  data: Joi.object().keys({
    statistics: Joi.object().keys({
      max: Joi.number().required(),
      min: Joi.number().required(),
      count: Joi.number().required(),
      sum: Joi.number().required()
    }),
    value: Joi.number(),
    unit: Joi.string().regex(/(Seconds|Microseconds|Milliseconds|Bytes|Kilobytes|Megabytes|Gigabytes|Terabytes|Bits|Kilobits|Megabits|Gigabits|Terabits|Percent|Count|Bytes\/Second|Kilobytes\/Second|Megabytes\/Second|Gigabytes\/Second|Terabytes\/Second|Bits\/Second|Kilobits\/Second|Megabits\/Second|Gigabits\/Second|Terabits\/Second|Count\/Second|None)/).required()
  }).xor('statistics', 'value'),
  function: Joi.func(),
  options: Joi.object().keys({
    region: Joi.string(),
    client: Joi.object()
  })
};
schemas.metrics = Joi.array().items(schemas.metric);


module.exports = function(inputMetrics, outputMetric, compositeFn, options) {
  options = options || {};
  Joi.assert(inputMetrics, schemas.metrics);
  Joi.assert(outputMetric, schemas.metric);
  Joi.assert(compositeFn, schemas.function);
  Joi.assert(options, schemas.options);

  var region = options.region || 'us-east-1';
  var cw = options.client || new AWS.CloudWatch({ region: region });

  function composite(period, callback) {
    if (typeof period === 'function') {
      callback = period;
      period = 60;
    }

    try { Joi.assert(period, Joi.number().multiple(60)); }
    catch(err) { return callback(err); }

    var endtime = Date.now();
    var starttime = endtime - period * 1000;

    var queue = async(10);

    inputMetrics.forEach(function(metric) {
      var params = {
        EndTime: endtime,
        StartTime: starttime,
        Period: period,
        MetricName: metric.metricName,
        Namespace: metric.namespace,
        Dimensions: [
          {
            Name: metric.dimensionName,
            Value: metric.dimensionValue
          }
        ],
        Statistics: [metric.statistic]
      };

      queue.defer(cw.getMetricStatistics.bind(cw), params);
    });

    queue.awaitAll(function(err, metrics) {
      if (err) return callback(err);
      var result = compositeFn(metrics);

      try{ Joi.assert(result, schemas.data); }
      catch(err) { return callback(err); }

      var params = {
        MetricData: [
          {
            MetricName: outputMetric.metricName,
            Dimensions: [
              {
                Name: outputMetric.dimensionName,
                Value: outputMetric.dimensionValue
              }
            ],
            Timestamp: Date.now(),
            Unit: result.unit || 'Count'
          }
        ]
      };

      if (result.statistics) {
        params.MetricData[0].StatisticValues = {
          Maximum: result.statistics.max,
          Minimum: result.statistics.min,
          SampleCount: result.statistics.count,
          Sum: result.statistics.sum
        };
      } else if (result.hasOwnProperty('value')) {
        params.MetricData[0].Value = result.value;
      }

      cw.putMetricData(params, callback);
    });
  }

  return composite;
};
