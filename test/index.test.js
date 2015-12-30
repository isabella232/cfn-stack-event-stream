var test = require('tape');
var Stream = require('../.');
var AWS = require('aws-sdk');

var cfn = new AWS.CloudFormation({region: 'us-east-1'});

test('emits an error for a non-existent stack', function (assert) {
    Stream(cfn, 'cfn-stack-event-stream-test')
        .on('data', function (e) {})
        .on('error', function (err) {
            assert.ok(err);
            assert.end();
        });
});

test('streams events until stack is complete', {timeout: 60000}, function (assert) {
    var events = [],
        stackName = 'cfn-stack-event-stream-test-create';

    cfn.createStack({
        StackName: stackName,
        TemplateBody: JSON.stringify(template)
    }, function (err) {
        assert.ifError(err);
        Stream(cfn, stackName)
            .on('data', function (e) {
                events.push(e);
            })
            .on('end', function () {
                cfn.deleteStack({StackName: stackName}, function(err) {
                    assert.ifError(err);
                    assert.deepEqual(events.map(function (e) { return e.ResourceStatus; }), [
                        'CREATE_IN_PROGRESS',
                        'CREATE_FAILED',
                        'ROLLBACK_IN_PROGRESS',
                        'DELETE_COMPLETE',
                        'ROLLBACK_COMPLETE'
                    ]);
                    assert.end();
                });
            });
    });
});

test('streams events during stack deletion', {timeout: 60000}, function (assert) {
    var events = [],
        stackName = 'cfn-stack-event-stream-test-delete',
        lastEventId;

    cfn.createStack({
        StackName: stackName,
        TemplateBody: JSON.stringify(template)
    }, function (err, stack) {
        assert.ifError(err);
        Stream(cfn, stackName)
            .on('data', function (e) {
                lastEventId = e.EventId;
            })
            .on('end', function () {
                cfn.deleteStack({StackName: stackName}, function(err) {
                    assert.ifError(err);
                    Stream(cfn, stack.StackId, {lastEventId: lastEventId})
                        .on('data', function (e) {
                            events.push(e);
                        })
                        .on('end', function () {
                            assert.deepEqual(events.map(function (e) { return e.ResourceStatus; }), [
                                'DELETE_IN_PROGRESS',
                                'DELETE_COMPLETE'
                            ]);
                            assert.end();
                        });
                });
            });
    });
});

var template = {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "cfn-stack-event-stream-test",
    "Resources": {
        "Test": {
            "Type": "AWS::AutoScaling::LaunchConfiguration",
            "Properties": {

            }
        }
    }
};