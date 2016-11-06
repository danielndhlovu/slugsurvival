var alertify = require('alertify.js'),
    Nanobar = require('nanobar');

module.exports = {

    Tracker: null,

    termsList: {},
    flatTermsList: [],
    termDates: {},
    termName: '',

    flatCourses: {},
    sortedCourses: {},

    courseInfo: {},

    flatSubjectList: [],
    subjectList: {},

    majorMinor: {},

    instructorNameToTidMapping: {},
    instructorStats: {},

    historicData: {},

    search: {},

    title: 'Index',

    colorMap: {
        // Buttons
        regular: '#509ACC',
        searchAnything: '#F27B50',
        share: '#EFC94C',
        alert: '#E05649',
        blank: '#FFFFFF',
        // Calendar
        TBA: '#E27A3F',
        custom: '#DF5A49',
        course: '#334D5C',
        section: '#45B29D',
        grayOut: '#D3D3D3',
        awaitSelection: '#45B29D'
    },

    daysTillDeadline: 21,

    events: {

    },
    dateMap: {
        'Monday': '2016-08-01',
        'Tuesday': '2016-08-02',
        'Wednesday': '2016-08-03',
        'Thursday': '2016-08-04',
        'Friday': '2016-08-05',
        'Saturday': '2016-08-06'
    },

    blockCheckVersion: false,
    shouldAddMargin: false,

    loading: new Nanobar(),
    alert: alertify.reset().closeLogOnClick(true).logPosition("bottom right").maxLogItems(1)
}
