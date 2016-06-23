let Bn = require('yours-bitcoin/lib/bn')

// see here for explanation: http://stackoverflow.com/questions/8595509/how-do-you-share-constants-in-nodejs-modules
function define (name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  })
}

define('CSV_DELAY', Bn(100))
