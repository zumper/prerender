/*jshint sub: true */
var url = require('url');

var util = exports = module.exports = {};

// Normalizes unimportant differences in URLs - e.g. ensures
// http://google.com/ and http://google.com normalize to the same string
util.normalizeUrl = function (u) {
    return url.format(url.parse(u, true));
};

// Gets the URL to prerender from a request, stripping out unnecessary parts
util.prepareState = function(req, doubleEncode) {
    var decodedUrl
      , fragment
      , parts;

    try {
        decodedUrl = decodeURIComponent(req.url);
    } catch (e) {
        decodedUrl = req.url;
    }

    parts = url.parse(decodedUrl, true);

    // Remove the _escaped_fragment_ query parameter
    if (parts.query && parts.query.hasOwnProperty('_escaped_fragment_')) {
        if (parts.query['_escaped_fragment_']) {
            parts.hash = '#!' + parts.query['_escaped_fragment_'];
        }
        fragment = parts.query['_escaped_fragment_'];
        delete parts.query['_escaped_fragment_'];
        delete parts.search;
    }
    // double uri encode unicode url parts to bypass phantomjs bug. add _double_encoded_ url param
    if (doubleEncode && parts.pathname.indexOf('%') >= 0) {
        parts.pathname = encodeURI(encodeURI(parts.pathname));
        parts.query['_double_encoded_'] = '1';
        delete parts.search;
    }

    var newUrl = url.format(parts);
    if (newUrl[0] === '/') { newUrl = newUrl.substr(1); }
    return {
        url: newUrl,
        start: new Date(),
        _escaped_fragment_: fragment
    };
};

var LOGGING = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4
};

var LOGGING_LEVEL = LOGGING[(process.env.PRERENDER_LOGGING_LEVEL || '').toUpperCase()] || LOGGING.INFO;

util._log = function(level, func) {
  level = level.toUpperCase();
  if (LOGGING_LEVEL <= LOGGING[level]) {
    var args = Array.prototype.slice.call(arguments, 0);
    args[0] = new Date().toISOString();
    args[1] = ' [' + level + ']';
    func.apply(func, args);
  }
};

util.debug = util._log.bind(util, 'DEBUG', console.log);
util.info = util._log.bind(util, 'INFO', console.info);
util.warn = util._log.bind(util, 'WARN', console.warn);
util.error = util._log.bind(util, 'ERROR', console.error);
util.log = util.debug;
