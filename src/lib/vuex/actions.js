var helper = require('./helper'),
    storage = require('./plugins/storage'),
    config = require('../../../config')

var self = module.exports = {
    setTitle: function(_, title) {
        _.commit('setTitle', title)
    },
    comingSoon: function(_) {
        _.getters.alert.okBtn('OK').alert('Coming soon')
    },
    ensureDataLoaded: function(_) {
        return _.dispatch('fetchTermsListAndRMP');
    },
    fetchThreeStatsByTid: function(_, tid) {
        if (typeof _.state.instructorStats[tid] !== 'undefined') {
            return Bluebird.resolve(_.state.instructorStats[tid]);
        }
        return Bluebird.all([
            fetch(config.dbURL + '/rmp/ratings/' + tid + '.json'),
            fetch(config.dbURL + '/rmp/scores/' + tid + '.json'),
            fetch(config.dbURL + '/rmp/stats/' + tid + '.json')
        ])
        .spread(function(ratingsRes, scoresRes, statsRes){
            return Bluebird.all([
                ratingsRes.json(),
                scoresRes.json(),
                statsRes.json()
            ])
        }).spread(function(ratings, scores, stats){
            var stats = {
                tid: tid,
                stats: {
                    ratings: ratings,
                    scores: scores,
                    stats: stats
                }
            };
            _.commit('saveInstructorStats', stats);
            return stats;
        })
    },
    fetchHistoricData: function(_) {
        if (typeof _.state.historicData.spring !== 'undefined') {
            return Bluebird.resolve();
        }
        return Bluebird.all([
            fetch(config.dbURL + '/offered/spring.json'),
            fetch(config.dbURL + '/offered/summer.json'),
            fetch(config.dbURL + '/offered/fall.json'),
            fetch(config.dbURL + '/offered/winter.json')
        ])
        .spread(function(springRes, summerRes, fallRes, winterRes){
            return Bluebird.all([
                springRes.json(),
                summerRes.json(),
                fallRes.json(),
                winterRes.json()
            ])
        })
        .spread(function(spring, summer, fall, winter){
            _.commit('saveHistoricData', {
                spring: spring,
                summer: summer,
                fall: fall,
                winter: winter
            });
        })
    },
    loadAutosave: function(_, payload) {
        termId = payload.termId;
        alert = (typeof payload.alert === 'undefined' ? true : false);
        return storage.getItem(termId).then(function(array) {
            if (array === null) return;
            return _.dispatch('parseFromCompact', {
                termId: termId,
                array: array
            }).then(function(events) {
                _.commit('restoreEventSourceSnapshot', {
                    termId: termId,
                    events: events
                });
                if (alert) _.getters.alert.okBtn('Cool!').alert('<p>We found a planner saved in your browser!</p>')
            })
        }.bind(this))
    },
    loadTermsAndRMPFromLocal: function(_) {
        var online;
        var self = this;
        var loadOnlineTimestamp = function() {
            return Bluebird.all([
                fetch(config.dbURL + '/timestamp/terms.json'),
                fetch(config.dbURL + '/timestamp/rmp.json')
            ]).spread(function(termsRes, rmpRes){
                return Bluebird.all([
                    termsRes.json(),
                    rmpRes.json()
                ])
            })
        }
        var loadOfflineTimestamp = function() {
            return Bluebird.all([
                storage.getItem('termsListTimestamp'),
                storage.getItem('rmpTimestamp')
            ])
        }
        var loadFromStorage = function(invalid) {
            return Bluebird.all([
                !invalid.termsList ? storage.getItem('termsList') : null,
                !invalid.rmp ? storage.getItem('rmp') : null
            ]).spread(function(termsList, rmp) {
                return _.dispatch('saveTermsAndRMP', {
                    termsList: termsList,
                    rmp: rmp,
                    skipSaving: true
                })
            })
        }
        return loadOnlineTimestamp()
        .then(function(timestamp) {
            online = timestamp;
            console.log('fetched online timestamp')
        })
        .catch(function(e) {
            console.log('fail to fetch online timestamp, checking local copy');
        })
        .finally(function() {
            return loadOfflineTimestamp().then(function(offline) {
                var invalid = {
                    yes: false,
                    termsList: false,
                    rmp: false
                }
                if (typeof online !== 'undefined') {
                    // loadOnlineTimestamp() success
                    if (online[0] !== offline[0]) {
                        invalid.yes = true;
                        invalid.termsList = true;
                        console.log('terms list timestamp differs');
                    }
                    if (online[1] !== offline[1]) {
                        invalid.yes = true;
                        invalid.rmp = true;
                        console.log('rmp mapping timestamp differs');
                    }
                }else{
                    // possibly no connectivity
                    if (offline[0] === null
                        || offline[1] === null) {
                        // We don't have a local copy
                        console.log(('no local copies to fallback'));
                        invalid = {
                            yes: true,
                            termsList: true,
                            rmp: true
                        }
                        return Bluebird.reject(invalid)
                    }
                }

                if (invalid.yes) console.log('some or all local copies are outdated')
                else console.log('local copies valid')

                return loadFromStorage(invalid).then(function () {
                    return Bluebird.reject(invalid);
                })
            })
        })
    },
    loadTermsAndRMPFromOnline: function(_, invalid) {
        var self = this;
        return Bluebird.all([
            invalid.termsList ? fetch(config.dbURL + '/terms.json') : null,
            invalid.rmp ? fetch(config.dbURL + '/rmp.json') : null
        ])
        .spread(function(termsRes, rmpRes){
            return Bluebird.all([
                invalid.termsList ? termsRes.json() : null,
                invalid.rmp ? rmpRes.json() : null
            ])
        })
        .spread(function(termsList, rmp) {
            return _.dispatch('saveTermsAndRMP', {
                termsList: termsList,
                rmp: rmp,
                skipSaving: false
            })
        })
    },
    saveTermsAndRMP: function(_, payload) {
        if (payload.termsList !== null) _.commit('saveTermsList', payload);
        if (payload.rmp !== null) _.commit('saveInstructorNameToTidMapping', payload);
    },
    fetchTermsListAndRMP: function(_) {
        if (_.state.flatTermsList.length !== 0) {
            return Bluebird.resolve();
        }
        return _.dispatch('loadTermsAndRMPFromLocal')
        .catch(function(invalid) {
            if (invalid.yes) {
                return _.dispatch('loadTermsAndRMPFromOnline', invalid)
            }
        })
    },
    loadCourseDataFromLocal: function(_, termId) {
        var online;
        var workaround = helper.iOS();
        var self = this;
        var loadOnlineTimestamp = function() {
            return Bluebird.all([
                fetch(config.dbURL + '/timestamp/terms/' + termId + '.json'),
                fetch(config.dbURL + '/timestamp/courses/' + termId + '.json'),
                fetch(config.dbURL + '/timestamp/index/' + termId + '.json')
            ]).spread(function(termsRes, InfoRes, indexRes){
                return Bluebird.all([
                    termsRes.json(),
                    InfoRes.json(),
                    indexRes.json()
                ])
            })
        }
        var loadOfflineTimestamp = function() {
            return Bluebird.all([
                storage.getItem('termCourseTimestamp-' + termId),
                storage.getItem('termCourseInfoTimestamp-' + termId),
                storage.getItem('termIndexTimestamp-' + termId)
            ])
        }
        var loadFromStorage = function(invalid) {
            return Bluebird.all([
                !invalid.coursesData ? storage.getItem('termCourse-' + termId) : null,
                !invalid.courseInfo ? storage.getItem('termCourseInfo-' + termId) : null,
                workaround ? null : (!invalid.index ? storage.getItem('termIndex-' + termId) : null)
            ]).spread(function(coursesData, courseInfo, index) {
                return _.dispatch('saveCourseData', {
                    termId: termId,
                    coursesData: coursesData,
                    courseInfo: courseInfo,
                    index: index,
                    skipSaving: true
                })
            })
        }
        return loadOnlineTimestamp()
        .then(function(timestamp) {
            online = timestamp;
            console.log('fetched online timestamp')
        })
        .catch(function(e) {
            console.log('fail to fetch online timestamp, checking local copy');
        })
        .finally(function() {
            return loadOfflineTimestamp().then(function(offline) {
                var invalid = {
                    yes: false,
                    coursesData: false,
                    courseInfo: false,
                    index: false
                }
                if (typeof online !== 'undefined') {
                    // loadOnlineTimestamp() success
                    if (online[0] !== offline[0]) {
                        invalid.yes = true;
                        invalid.coursesData = true;
                        console.log('courses data timestamp differs');
                    }
                    if (online[1] !== offline[1]) {
                        invalid.yes = true;
                        invalid.courseInfo = true;
                        console.log('course info timestamp differs');
                    }
                    if (!workaround && online[2] !== offline[2]) {
                        invalid.yes = true;
                        invalid.index = true;
                        console.log('index timestamp differs');
                    }
                }else{
                    // possibly no connectivity
                    if (offline[0] === null
                        || offline[1] === null
                        || (!workaround && offline[2] === null)) {
                        // We don't have a local copy
                        console.log(('no local copies to fallback'));
                        invalid = {
                            yes: true,
                            coursesData: true,
                            courseInfo: true,
                            index: true
                        }
                        return Bluebird.reject(invalid)
                    }
                }

                if (invalid.yes) console.log('some or all local copies are outdated')
                else console.log('local copies valid')

                return loadFromStorage(invalid).then(function () {
                    return Bluebird.reject(invalid);
                })
            })
        })
    },
    loadCourseDataFromOnline: function(_, payload) {
        var workaround = helper.iOS();
        var invalid = payload.invalid, termId = payload.termId;
        var self = this;
        return Bluebird.all([
            invalid.coursesData ? fetch(config.dbURL + '/terms/' + termId + '.json') : null,
            invalid.courseInfo ? fetch(config.dbURL + '/courses/' + termId + '.json') : null,
            workaround ? null : (invalid.index ? fetch(config.dbURL + '/index/' + termId + '.json') : null)
        ])
        .spread(function(courseDataRes, courseInfoRes, indexRes){
            return Bluebird.all([
                invalid.coursesData ? courseDataRes.json() : null,
                invalid.courseInfo ? courseInfoRes.json() : null,
                workaround ? null : (invalid.index ? indexRes.json() : null)
            ])
        })
        .spread(function(coursesData, courseInfo, index) {
            return _.dispatch('saveCourseData', {
                termId: termId,
                coursesData: coursesData,
                courseInfo: courseInfo,
                index: index,
                skipSaving: false
            })
        })
    },
    saveCourseData: function(_, payload) {
        var workaround = helper.iOS();
        var termId = payload.termId, coursesData = payload.coursesData, courseInfo = payload.courseInfo, skipSaving = payload.skipSaving, index = payload.index;
        if (coursesData !== null) _.commit('saveTermCourses', payload);
        if (courseInfo !== null) _.commit('saveCourseInfo', payload);
        if (workaround || index !== null) _.commit('buildIndexedSearch', {
            termId: termId,
            index: index,
            workaround: workaround,
            skipSaving: skipSaving
        });
    },
    fetchTermCourses: function(_, termId) {
        termId =  termId || _.getters.termId;
        _.commit('setTermName', _.state.termsList[termId])
        if (typeof _.state.flatCourses[termId] !== 'undefined') {
            return Bluebird.resolve();
        }
        return _.dispatch('loadCourseDataFromLocal', termId)
        .catch(function(invalid) {
            if (invalid.yes) {
                return _.dispatch('loadCourseDataFromOnline', {
                    invalid: invalid,
                    termId: termId
                })
            }
        })
    },
    fetchThreeStatsByFirstLastName: function(_, payload) {
        var tid = _.state.instructorNameToTidMapping[payload.firstName + payload.lastName];
        if (typeof tid === 'undefined') {
            return Bluebird.resolve(null);
        }
        return _.dispatch('fetchThreeStatsByTid', tid);
    },
    dispatchReplaceHash: function(_) {
        var termId = _.getters.termId;
        _.commit('replaceHash', termId);
    },
    parseFromCompact: function(_, payload) {
        var events = [];
        var index, split = [], courseNum, course, courseInfo, termId = payload.termId, array = payload.array;
        return Bluebird.mapSeries(array, function(obj) {
            obj = obj + '';
            index = obj.indexOf('-');
            if (index === -1) {
                split[0] = obj;
                delete split[1];
            }else{
                split[0] = obj.substring(0, index);
                split[1] = obj.substring(index + 1);
            }
            var p = function() {
                if (split[0] / 100000 >= 1) {
                    /*
                    we found a traitor!

                    be careful here, we don't want to override any localized course num,
                    so we are going to reassign course number for the customize events
                    */
                    courseNum = helper.findNextCourseNum(_.state.flatCourses[termId], 100000);
                    course = JSON.parse(split[1]);
                    // Remember to override the course number in the course subject
                    course.num = courseNum;
                    courseInfo = helper.generateCourseInfoObjectFromExtra(courseNum, {});
                    return _.dispatch('populateLocalEntriesWithExtra', {
                        termId: termId,
                        courseNum: courseNum,
                        courseObj: course,
                        courseInfo: courseInfo
                    })
                }else{
                    return Bluebird.resolve();
                }
            }

            return p().then(function() {
                if (typeof split[1] !== 'undefined' && split[0] / 100000 < 1) {
                    if (split[1] == 'null') split[1] = null;
                    return _.dispatch('getEventObjectsByCourse', {
                        termId: termId,
                        courseNum: split[0],
                        sectionNum: split[1]
                    }).then(function(eventObj) {
                        events = events.concat(eventObj);
                    })
                }else{
                    return _.dispatch('getEventObjectsByCourse', {
                        termId: termId,
                        courseNum: split[0]
                    }).then(function(eventObj) {
                        events = events.concat(eventObj);
                    })
                }
            })
        })
        .then(function() {
            return events;
        })
    },
    decodeHash: function(_) {
        var termId = _.getters.termId;
        try {
            console.log('trying to restore events from hash')
            var hash = window.location.hash.substring(1);
            var string = LZString.decompressFromEncodedURIComponent(hash);
            if (string.length === 0) {
                string = helper.Base64.decode(hash);
            }
            var array = JSON.parse(string);
            if (typeof array.forEach !== 'undefined') {
                console.log('valid hash found')
                var split;
                var course;

                return _.dispatch('parseFromCompact', {
                    termId: termId,
                    array: array
                }).then(function(events) {
                    _.commit('restoreEventSourceSnapshot', {
                        termId: termId,
                        events: events
                    });

                    var html = '';
                    html += ['<p>', 'Looks like you are accessing the planner via a bookmark link! We have the planner for you!', '</p>'].join('');
                    html += ['<p>', 'However, you will <b>not</b> be able to make changes if you are viewing the planner via a bookmark link.', '</p>'].join('');

                    _.getters.alert
                    .okBtn('OK')
                    .alert(html);
                    return Bluebird.reject();
                })
            }else{
                console.log('fallback to local copy')
                return Bluebird.resolve();
            }
        }catch(e) {
            console.log(e);
            console.log('fallback to local copy')
            return Bluebird.resolve();
        }
    },
    refreshCalendar: function(_) {
        $('#calendar-' + _.getters.termId).fullCalendar('refetchEvents');
        $('.alertify').remove();
    },
    returnEventSourceSnapshot: function(_) {
        var termId = this.termId;
        return _.state.events[termId]
    },
    emptyEventSource: function(_, termId) {
        _.commit('emptyEventSource', termId);
    },
    getEventObjectsByCourse: function(_, payload) {
        /*
            To be DRY, this function is unnecessarily huge
        */
        var dateMap = _.state.dateMap;
        var colorMap = _.state.colorMap;
        var events = [];
        var obj = {};
        var courseNum, course, courseInfo, sectionNumber, section, conflict;
        var termId = payload.termId, secSeats = (typeof payload.secSeats === 'undefined' ? null : payload.secSeats);

        awaitSelection = (payload.awaitSelection === true);

        // We are not sure that if input1 is a course object or course number
        if (typeof payload.courseNum !== 'undefined') {
            courseNum = payload.courseNum;
            course = _.state.flatCourses[termId][courseNum];
            courseInfo = _.state.courseInfo[termId][courseNum];
        }

        if (typeof payload.courseObj !== 'undefined') {
            course = payload.courseObj;
            courseNum = course.num;
            courseInfo = _.state.courseInfo[termId][courseNum];
        }

        var courseObj = function(course, startDay, endDay, t) {
            var obj = {};
            obj.title = [(typeof course.s === 'undefined' ? course.c : course.c + ' - ' + course.s), courseInfo.ty].join("\n");
            obj.number = course.num;
            obj.allDay = false;
            obj.start = dateMap['Monday'];
            obj.end = dateMap['Saturday'];
            obj.course = course;
            obj.color = colorMap.course;
            if (t === false) {
                // class is cancelled
                obj.color = 'black';
            }else if (t === null) {
                // class is indeed to be annouced
                obj.color = colorMap.TBA;
            }else{
                // Normal class
                obj.start = dateMap[startDay] + ' ' + t.time.start;
                obj.end = dateMap[endDay] + ' ' + t.time.end;
            }
            if (course.custom) obj.color = colorMap.custom;
            return obj;
        }

        // Process course
        for (var j = 0, locts = course.loct, length = locts.length; j < length; j++) {
            if (!!!locts[j].t) {
                events.push(courseObj(course, 'Monday', 'Saturday', course.loct[0].t))
            }else{
                for (var i = 0, days = locts[j].t.day, length1 = days.length; i < length1; i++) {
                    events.push(courseObj(course, days[i], days[i], locts[j].t))
                }
            }
        }

        section = _.getters.courseInfo[termId][courseNum].sec.length > 0;

        if (section === false && awaitSelection !== true) return events;

        // Now we process sections

        if (typeof payload.sectionNum !== 'undefined' && payload.sectionNum !== null) {
            sectionNumber = payload.sectionNum;
        }else if (payload.sectionNum === null && awaitSelection !== true) {
            sectionNumber = null;
        }

        var seat = null;

        var getSeatBySectionNum = function(seats, secNum) {
            return seats.filter(function(el) {
                return el.num == secNum;
            })[0];
        }

        if (awaitSelection) {

            obj.title = ['Now You Are Choosing Section', 'For ' + course.c].join("\n");
            obj.number = course.num;
            obj.sectionNum = null;
            obj.color = colorMap.awaitSelection;
            obj.course = course;
            obj.section = false;
            obj.conflict = false;
            obj.awaitSelection = true;
            obj.start = dateMap['Monday'];
            obj.end = dateMap['Saturday'];
            events.push(obj);
            obj = {};
        }

        if (!awaitSelection && sectionNumber === null) {
            obj.title = ['Please Choose a Section', 'For ' + course.c].join("\n");
            obj.number = course.num;
            obj.sectionNum = null
            obj.color = colorMap.awaitSelection;
            obj.course = course;
            obj.section = false;
            obj.conflict = false;
            obj.awaitSelection = awaitSelection;
            obj.start = dateMap['Monday'];
            obj.end = dateMap['Saturday'];
            events.push(obj);
            obj = {};
            return events;
        }

        var secObj = function(course, section, awaitSelection, startDay, endDay, t) {
            var obj = {};
            obj.title = [course.c, 'Section ' + section.sec].join("\n")
            obj.number = course.num;
            obj.sectionNum = section.num;
            obj.color = colorMap.section;
            obj.course = course;
            obj.section = section;
            obj.conflict = false;
            obj.awaitSelection = awaitSelection;
            obj.start = dateMap['Monday'];
            obj.end = dateMap['Saturday'];
            if (t === false) {
                // section is cancelled
                obj.color = 'black';
            }else if (t === null) {
                // section is indeed to be annouced
                obj.color = colorMap.TBA;
            }else{
                // Normal section
                obj.start = dateMap[startDay] + ' ' + t.time.start;
                obj.end = dateMap[endDay] + ' ' + t.time.end;
            }
            if (awaitSelection) {
                obj.color = colorMap.awaitSelection;
            }
            return obj;
        }

        for (var i = 0, sections = courseInfo.sec, length = sections.length; i < length; i++) {
            if (!awaitSelection && sectionNumber !== null && sections[i].num != sectionNumber) continue;
            if (!!!sections[i].loct[0].t) {
                events.push(secObj(course, sections[i], awaitSelection, 'Monday', 'Saturday', sections[i].loct[0].t))
            }else{
                for (var j = 0, days = sections[i].loct[0].t.day, length2 = days.length; j < length2; j++) {
                    events.push(secObj(course, sections[i], awaitSelection, days[j], days[j], sections[i].loct[0].t))
                }
            }
        }

        return events;
    },
    getCurrentAwaitSection: function(_, termId) {
        if (typeof _.state.events[termId] === 'undefined') return false;
        var events = _.state.events[termId];
        var currentAwait = events.filter(function(el) {
            return el.awaitSelection === true;
        })
        if (currentAwait.length === 0) return false;
        return currentAwait[0];
    },
    grayOutEvents: function(_, termId) {
        _.commit('grayOutEvents', termId);
    },
    restoreEventsColor: function(_, termId) {
        _.commit('restoreEventsColor', termId);
    },
    pushToEventSource: function(_, payload) {
        var termId = payload.termId, course = payload.courseObj, customEvent = payload.custom;

        var p = function() {
            if (customEvent === true) {
                _.dispatch('removeFromSource', {
                    termId: termId,
                    courseNum: course.num,
                    skipSaving: true
                });

                return _.dispatch('getEventObjectsByCourse', {
                    termId: termId,
                    courseObj: course,
                    awaitSelection: false,
                    secSeats: null
                })
            }else{
                _.dispatch('removeFromSource', {
                    termId: termId,
                    courseNum: course.num,
                    skipSaving: false
                });

                return _.dispatch('getEventObjectsByCourse', {
                    termId: termId,
                    courseObj: course,
                    sectionNum: null,
                    awaitSelection: false,
                    secSeats: null
                })
            }
        }

        return p().then(function(events) {
            _.commit('mergeEventSource', {
                termId: termId,
                events: events,
                skipSaving: false
            });

            return Bluebird.resolve();
        })

    },
    pushSectionToEventSource: function(_, payload) {
        var termId = payload.termId, courseNum = payload.courseNum, sectionNum = payload.sectionNum;
        var events = [];

        _.dispatch('removeFromSource', {
            termId: termId,
            courseNum: courseNum,
            skipSaving: false
        });

        return _.dispatch('getEventObjectsByCourse', {
            termId: termId,
            courseNum: courseNum,
            sectionNum: sectionNum,
            awaitSelection: false,
            secSeats: null
        }).then(function(events) {
            _.commit('mergeEventSource', {
                termId: termId,
                events: events,
                skipSaving: false
            });

            return Bluebird.resolve();
        })
    },
    pushAwaitSectionsToEventSource: function(_, payload) {
        _.getters.loading.go(50);
        var secSeats = null, termId = payload.termId, courseNum = payload.courseNum;

        return _.dispatch('fetchRealTimeEnrollment', {
            termCode: termId,
            courseNum: courseNum
        })
        .then(function(res) {
            if (res.ok && res.results[0] && res.results[0].seats) {
                secSeats = res.results[0].seats.sec;
            }
            _.getters.loading.go(70);
            return _.dispatch('getEventObjectsByCourse', {
                termId: termId,
                courseNum: courseNum,
                sectionNum: null,
                awaitSelection: true,
                secSeats: secSeats
            }).then(function(events) {
                _.commit('mergeEventSource', {
                    termId: termId,
                    events: events,
                    skipSaving: true
                });

                _.dispatch('refreshCalendar');
                _.getters.loading.go(100);
                _.getters.alert.success('Now You Are Choosing Section For ' + _.state.flatCourses[termId][courseNum].c)
            })
        }.bind(this))
    },
    removeFromSource: function(_, payload) {
        _.commit('removeFromSource', payload);
    },
    _showInstructorRMP: function(_, string) {
        _.getters.loading.go(30);
        var split = string.split('+');
        var firstName = split[0], lastName = split[1]
        var html = '';
        var template = function(key, value) {
            return ['<p>', '<span class="muted h6">', key, ': </span><b class="h5">', value, '</b>', '</p>'].join('');
        }
        _.dispatch('fetchThreeStatsByFirstLastName', {
            firstName: firstName,
            lastName: lastName
        })
        .then(function(rmp) {
            _.getters.loading.go(70);
            if (rmp !== null) {
                var obj = rmp.stats.stats.quality;
                var max = Object.keys(obj).reduce(function(a, b){ return obj[a] > obj[b] ? a : b });
                html += template('Quality', firstName + ' is ' + max)
                html += template('Clarity', rmp.stats.stats.clarity.toFixed(1))
                html += template('Easy', rmp.stats.stats.easy.toFixed(1))
                html += template('Overall', rmp.stats.stats.overall.toFixed(1))
                html += template('Based on', rmp.stats.scores.count + ' ratings')
                _.getters.alert
                .okBtn('See it for yourself')
                .cancelBtn('Go Back')
                .confirm(html)
                .then(function(resolved) {
                    resolved.event.preventDefault();
                    if (resolved.buttonClicked !== 'ok') return;
                    window.open('http://www.ratemyprofessors.com/ShowRatings.jsp?tid=' + rmp.tid);
                })
            }else{
                _.getters.alert
                .okBtn('Go Back')
                .alert(['<p>', 'Sorry, we don\'t have', firstName + '\'s', 'ratings!', '</p>'].join(' '))
            }
        }.bind(this))
        .catch(function(e) {
            console.log(e);
            _.getters.alert.error('Cannot fetch RMP stats!')
        }.bind(this))
        .finally(function() {
            _.getters.loading.go(100);
        }.bind(this))
    },
    noAwaitSection: function(_, termId) {
        if (typeof _.state.events[termId] === 'undefined') return true;
        return _.state.events[termId].filter(function(el){
            return el.awaitSelection === true;
        }).length === 0;
    },
    exportICS: function(_) {
        var termId = _.getters.termId;
        var termDates = _.state.termDates[termId];
        var events = _.state.events[termId];

        if (typeof events === 'undefined') return;
        var cal = ics();

        var compact = helper.compact(events);
        var split = [], course, courseInfo;

        for (var i = 0, length = compact.length; i < length; i++) {
            split = compact[i].split('-');
            course = _.state.flatCourses[termId][split[0]];
            courseInfo = _.state.courseInfo[termId][split[0]];

            for (var j = 0, locts = course.loct, length1 = locts.length; j < length1; j++) {
                helper.addCal(cal, termDates, course, courseInfo.ty, locts[j]);
                if (!split[1]) continue;
                for (var k = 0, sec = courseInfo.sec, length2 = sec.length; k < length2; k++) {
                    if (sec[k].num != split[1]) continue;
                    for (var m = 0, secLocts = sec[k].loct, length3 = secLocts.length; m < length3; m++) {
                        helper.addCal(cal, termDates, course, 'Section', secLocts[m]);
                    }
                }
            }
        }

        cal.download('Schedule for ' + _.state.termName);
    },
    fetchRealTimeEnrollment: function(_, payload) {
        return fetch(config.trackingURL + '/fetch/' + payload.termCode + '/' + payload.courseNum)
        .then(function(res) {
            return res.json();
        })
        .catch(function(e) {
            return {ok: false}
        })
    },
    _showRealTimeEnrollment: function(_, string) {
        _.getters.loading.go(30);
        var split = string.split('+');
        var termCode = split[0], courseNum = split[1];
        var html = '';
        var template = function(key, value) {
            return ['<p>', '<span class="muted h6">', key, ': </span><b class="h5">', value, '</b>', '</p>'].join('');
        }
        return _.dispatch('fetchRealTimeEnrollment', {
            termCode: termCode,
            courseNum: courseNum
        })
        .then(function(res) {
            _.getters.loading.go(70);
            if (res.ok && res.results[0] && res.results[0].seats) {
                var latest = res.results[0];
                var seat = latest.seats;

                html += template('Status', seat.status);
                html += template('Available', seat.avail);
                html += template('Enrolled', seat.enrolled);
                html += template('Capacity', seat.cap);
                html += '<hr />';
                html += template('Waitlisted', seat.waitTotal);
                html += template('Waitlist Cap.', seat.waitCap);
                html += '<p><span class="muted h6">Last Changed: ' + new Date(latest.date * 1000).toLocaleString() + '</span></p>';

                _.getters.alert
                .okBtn('Cool')
                .alert(html)
                .then(function(resolved) {
                    resolved.event.preventDefault();
                })
            }else{
                _.getters.alert.error('Cannot fetch real time data!')
            }
            _.getters.loading.go(100);
        }.bind(this))
    },
    getCourseDom: function(_, payload) {
        // TODO: Reduce special cases
        var termId = payload.termId, course = payload.courseObj, isSection = payload.isSection;
        isSection = isSection || false;
        if (!isSection) {
            var courseHasSections = _.getters.courseInfo[termId][course.num].sec.length > 0;
        }
        var html = '';
        var template = function(key, value) {
            return ['<p>', '<span class="muted h6">', key, ': </span><b class="h5">', value, '</b>', '</p>'].join('');
        }

        if (course.custom) {
            html += template('Title', course.c);
            html += template('Desc', course.n);
        }

        if (isSection) {
            html += template('Section', 'DIS - ' + course.sec);
            html += template('TA', course.ins);
        }else if (course.custom !== true){
            html += template('Course Number', course.num);
            html += template(course.c, courseHasSections ? 'has sections': 'has NO sections');
            html += template('Course Name', course.n);
            html += template('Instructor(s)', course.ins.d.join(', ') + (!!!course.ins.f ? '' : '&nbsp;<sup class="muted clickable rainbow" onclick="window.App.$store.dispatch(\'_showInstructorRMP\', \'' + course.ins.f.replace(/'/g, '\\\'') + '+' + course.ins.l.replace(/'/g, '\\\'') + '\')">RateMyProfessors</sup>') );
        }

        html += '<hr />';

        var loctTmpl = function(index) {
            html += template('Location', course.loct[index].t === false ? 'Cancelled' : !!!course.loct[index].loc ? 'TBA': course.loct[index].loc);
            html += template('Meeting Day', course.loct[index].t === false ? 'Cancelled' : course.loct[index].t === null ? 'TBA' : course.loct[index].t.day.join(', '));
            html += template('Meeting Time', !!!course.loct[index].t ? 'TBA' : course.loct[index].t === false ? 'Cancelled' : course.loct[index].t === null ? 'TBA' : helper.tConvert(course.loct[index].t.time.start) + '-' + helper.tConvert(course.loct[index].t.time.end));
        }

        for (var j = 0, locts = course.loct, length1 = locts.length; j < length1; j++) {
            loctTmpl(j);
            html += '<hr />'
        }

        if (!isSection && course.custom !== true) {
            html += template('Is It Open', '<span class="muted clickable rainbow" onclick="window.App.$store.dispatch(\'_showRealTimeEnrollment\', \'' + termId + '+' + course.num + '\')">Check Real Time</span>');
        }

        return html;
    },
    updateWatch: function(_, payload) {
        var self = this, recipient = payload.recipient, code = payload.code, courses = payload.courses;
        return fetch(config.notifyURL + '/watch/update', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: recipient,
                code: code,
                courses: courses.map(function(el) {
                    return el.num
                })
            })
        })
        .then(function(res) {
            return res.json()
            .catch(function(e) {
                return res.text();
            })
        })
        .then(function(res) {
            if (!res.ok) {
                return _.getters.alert.error(res.message);
            }
        })
        .catch(function(e) {
            console.log(e);
            _.getters.alert.error('An error has occurred.')
        })
    },
    populateLocalEntriesWithExtra: function(_, payload) {
        _.commit('appendCourse', payload);
        _.commit('appendCourseInfo', payload);
    },
    fetchGE: function(_) {
        return fetch(config.dbURL + '/ge.json')
        .then(function(res) {
            return res.json();
        })
    },
    calculateDropDeadline: function(_, termId) {
        if (typeof _.state.termDates[termId] === 'undefined') return null;
        var start = _.state.termDates[termId].start;
        var deadline = new Date(start);
        deadline.setDate(deadline.getDate() + _.state.daysTillDeadline);
        return deadline;
    },
    passDropDeadline: function(_, termId) {
        if (typeof _.state.termDates[termId] === 'undefined') return null;
        var start = _.state.termDates[termId].start;
        var today = new Date();
        var deadline = new Date(start);
        deadline.setDate(deadline.getDate() + _.state.daysTillDeadline);
        return deadline.getTime() < today.getTime();
    }
}
