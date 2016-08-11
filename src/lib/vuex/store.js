var	Vue = require('vue'),
    Vuex = require('vuex'),
    storage = require('./plugins/storage');

Vue.use(Vuex);

var store = new Vuex.Store({
    state: require('./state'),
    mutations: require('./mutations'),
    plugins: [
        require('./plugins/autosave')(storage),
        require('./plugins/offline')(storage)
    ]
})

module.exports = store;
