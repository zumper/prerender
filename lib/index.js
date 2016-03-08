var cluster = require('cluster')
  , os = require('os')
  , fs = require('fs')
  , path = require('path')
  , http = require('http')
  , _ = require('lodash')
  , util = require('./util')
  , basename = path.basename;

// fix resource leak, per:
// https://github.com/nodejs/node-v0.x-archive/issues/9409#issuecomment-84038111
function workAround(worker) {
  util.info('Worker #' + worker.id + ' (pid ' + worker.process.pid + '): reporting for duty');
  var listeners = null;

  listeners = worker.process.listeners('exit')[0];
  var exit = listeners[Object.keys(listeners)[0]];

  listeners = worker.process.listeners('disconnect')[0];
  var disconnect = listeners[Object.keys(listeners)[0]];

  worker.process.removeListener('exit', exit);
  worker.process.once('exit', function(exitCode, signalCode) {
    if (worker.state != 'disconnected') {
      disconnect();
    }
    exit(exitCode, signalCode);
  });
}


// Starts either a server or client depending on whether this is a master or
// worker cluster process
exports = module.exports = function(options) {
    var port = options.port || process.env.PORT || 3000;

    if(!options.phantomBasePort) {
        options.phantomBasePort = process.env.PHANTOM_CLUSTER_BASE_PORT || 12300;
    }

    var server = require('./server');
    options.isMaster = cluster.isMaster;
    options.worker = cluster.worker;
    server.init(options);

    if(cluster.isMaster) {

        for (var i = 0; i < (options.workers || os.cpus().length); i += 1) {
            util.info('Master: starting worker #' + (i + 1));
            workAround(cluster.fork());
        }

        cluster.on('exit', function (worker) {
            util.warn('Master: worker #' + worker.id + ' (pid ' + worker.process.pid + ') died, starting new worker');
            workAround(cluster.fork());
        });
    } else {
        if (process.env.PRERENDER_WORKER_INIT_CMD) {
          require('runsync').execFile(process.env.PRERENDER_WORKER_INIT_CMD);
        }

        var httpServer = http.createServer(_.bind(server.onRequest, server));

        httpServer.listen(port, function () {
            util.info('Worker (pid ' + process.pid + '): ' + 'Server running on port ' + port);
        });
    }

    return server;
};

fs.readdirSync(__dirname + '/plugins').forEach(function(filename){
    if (!/\.js$/.test(filename)) return;
    var name = basename(filename, '.js');
    function load(){ return require('./plugins/' + name); }
    Object.defineProperty(exports, name, {value: load});
});
