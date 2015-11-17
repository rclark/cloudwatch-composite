# cloudwatch-composite

Constructs a function that you can call to calculate a composite metric from a set of CloudWatch metrics.

### Usage

1. Define metrics to fetch

  ```js
  var inputMetrics = [
    {
      metricName: 'MetricA',
      namespace: 'MyNamespace',
      statistic: 'Sum',
      dimensionName: 'TableName',
      dimensionValue: 'MyTable'
    },
    {
      metricName: 'MetricB',
      namespace: 'MyNamespace',
      statistic: 'Sum',
      dimensionName: 'TableName',
      dimensionValue: 'MyOtherTable'
    }
  ];
  ```
2. Define an output metric to put to

  ```js
  var outputMetric = {
    metricName: 'CompositeAB',
    namespace: 'MyNamespace',
    statistic: 'Sum',
    dimensionName: 'Tables',
    dimensionValue: 'MyTableAndMyOtherTable'
  };
  ```

3. Create a function that will perform a comparison. This function will be passed the [getMetricStatistics results](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatch.html#getMetricStatistics-property) for each of the `inputMetrics` in the same order that you provided them. The object that is returned will be converted into a [putMetricData request](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatch.html#putMetricData-property) to your provided `outputMetric`.

  ```js
  function compositeThem(metrics) {
    return {
      value: 12,
      unit: 'Count'
    };
  }
  ```

4. Use this library to compose a composite function.

  ```js
  var composite = require('cloudwatch-composite')(
    inputMetrics,
    outputMetric,
    compositeThem
  );
  ```

5. Run the composite function, optionally specifying a period. The function will make metrics requests, pass them to your `compositeThem` function, then put the result to your `outputMetric`.

  ```js
  composite(function(err) {
    if (err) throw err;
    console.log('Composited MetricA + MetricB --> CompositeAB');
  });
  ```
