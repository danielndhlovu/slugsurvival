var helper = require('./helper')

var self = module.exports = {
	alert: function(_) {
		return _.state.alert;
	},
	setTitle: function(_, title) {
		_.dispatch('setTitle', title)
	},
	iOS: function(_) {
		var userAgent = window.navigator.userAgent;
		if (userAgent.match(/iPad/i) || userAgent.match(/iPhone/i)) {
			return true;
		}
		return false;
	}, // http://stackoverflow.com/questions/3007480/determine-if-user-navigated-from-mobile-safari
	ensureDataLoaded: function(_) {
		var promises = []
		if (_.state.flatTermsList.length === 0) {
			promises.push(this.fetchTerms());
		}
		if (Object.keys(_.state.instructorNameToTidMapping).length === 0) {
			promises.push(this.fetchInstructorNameToTidMapping());
		}
		return Promise.all(promises);
	},
	fetchTerms: function(_) {
		return fetch('/db/terms.json')
			.then(function(res) {
				return res.json();
			})
			.then(function(data) {
				_.dispatch('saveTermsList', data);
				return data;
			})
	},
	fetchInstructorNameToTidMapping: function(_) {
		return fetch('/db/rmp.json')
			.then(function(res) {
				return res.json();
			})
			.then(function(data) {
				_.dispatch('saveInstructorNameToTidMapping', data);
				return data;
			})
	},
	fetchThreeStatsByTid: function(_, tid) {
		if (typeof _.state.instructorStats[tid] !== 'undefined') {
			return Promise.resolve(_.state.instructorStats[tid]);
		}
		return Promise.all([
			fetch('/db/rmp/ratings/' + tid + '.json'),
			fetch('/db/rmp/scores/' + tid + '.json'),
			fetch('/db/rmp/stats/' + tid + '.json')
		])
		.spread(function(ratingsRes, scoresRes, statsRes){
			return Promise.all([
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
			_.dispatch('saveInstructorStats', stats);
			return stats;
		})
	},
	fetchTermCourses: function(_) {
		var termId = this.termId;

		var workaround = this.iOS();

		/*

		Apparently, according to http://stackoverflow.com/questions/29552139/website-repeatedly-reloads-then-crashes-on-iphone-4-ios-8-0-2-ios-8-1-2
		iOS crashes on loading the index JSON from lunr.js. However, building the index on the fly does not crash browser
		Thus, the workaround for iOS devices is to build the index from scratch

		*/

		_.dispatch('setTermName', _.state.termsList[termId])
		if (typeof _.state.flatCourses[termId] === 'undefined') {
			return Promise.all([
				fetch('/db/terms/' + termId + '.json'),
				fetch('/db/courses/' + termId + '.json'),
				workaround ? null : fetch('/db/index/' + termId + '.json')
			])
			.spread(function(courseDataRes, courseInfoRes, indexRes){
				return Promise.all([
					courseDataRes.json(),
					courseInfoRes.json(),
					workaround ? null : indexRes.json()
				])
			})
			.spread(function(coursesData, courseInfo, index){
				_.dispatch('saveTermCourses', termId, coursesData);
				_.dispatch('saveCourseInfo', termId, courseInfo);
				_.dispatch('buildIndexedSearch', termId, index, workaround);
			})
		} else {
			return Promise.resolve()
		}
	},
	fetchThreeStatsByFirstLastName: function(_, firstName, lastName) {
		var tid = _.state.instructorNameToTidMapping[firstName + lastName];
		if (typeof tid === 'undefined') {
			return Promise.resolve(null);
		}
		return this.fetchThreeStatsByTid(tid);
	},
	courseHasSections: function(_, courseNumber) {
		var termId = this.termId;
		return _.state.courseInfo[termId][courseNumber].sec.length > 0;
	},
	refreshCalendar: function(_) {
		$('#calendar-' + this.termId).fullCalendar('refetchEvents')
	},
	returnEventSourceSnapshot: function(_) {
		var termId = this.termId;
		return _.state.events[termId]
	},
	pushToEventSource: function(_, course, edit, changed) {
		edit = edit || false;
		changed = changed || true;
		var termId = this.termId;
		var courseInfo = _.state.courseInfo[termId][course.num];
		var code;
		var obj = {};
		if (!!!course.t) {
			// TBA will be in the allDaySlot
			obj.title = [course.c + ' - ' + course.s, courseInfo.ty, course.n].join("\n");
			obj.number = course.num;
			obj.allDay = true;
			obj.start = _.state.dateMap['Monday'];
			obj.end = _.state.dateMap['Saturday'];
			obj.course = course;
			obj.color = 'green';
			_.dispatch('pushToEventSource', termId, obj);
			obj = {};
		} else {
			for (var i = 0, days = course.t.day, length = days.length; i < length; i++) {
				obj.title = [course.c + ' - ' + course.s, courseInfo.ty, course.n].join("\n");
				obj.number = course.num;
				obj.allDay = false;
				obj.start = _.state.dateMap[days[i]] + ' ' + course.t.time.start;
				obj.end = _.state.dateMap[days[i]] + ' ' + course.t.time.end;
				obj.course = course;
				_.dispatch('pushToEventSource', termId, obj);
				obj = {};
			}
		}
		this.refreshCalendar();
		if (edit && changed) {
			this.alert().success(course.c + ' edited!')
		} else {
			this.alert().success(course.c + ' added to the planner!')
		}
		return Promise.resolve();
	},
	removeFromSource: function(_, termId, courseNumber) {
		_.dispatch('removeFromSource', termId, courseNumber);
	},
	removeEmptySection: function(_, termId, courseNumber) {
		_.dispatch('removeEmptySection', termId, courseNumber)
	},
	_pushSectionToEventSource: function(_, courseNumber, sectionNumber, edit) {
		edit = edit || false;
		var termId = this.termId;
		var courseInfo = _.state.courseInfo[termId][courseNumber];
		var courses = _.state.flatCourses[termId];
		var obj = {};
		var snapshot = [];
		var section = {};
		var code;

		var course = courses[courseNumber];

		if (edit) {
			// Let's check if user selects "Choose Later" again
			if (sectionNumber === null) {
				this.removeEmptySection(termId, course.num);
			}else{
				this.removeFromSource(termId, course.num);
			}
		}

		section = courseInfo.sec.filter(function(section) {
			return section.num == sectionNumber
		});
		section = section[0];
		snapshot = this.returnEventSourceSnapshot();

		if (typeof section !== 'undefined' && (code = this.checkForConflict(section)) !== false) {
			this.alert().error('Section ' + section.section + ' conflict with ' + code + '!')
			if (edit) _.dispatch('restoreEventSourceSnapshot', termId, snapshot);
			return Promise.resolve();
		}

		if (sectionNumber === null || !!!section.t) {
			// TBA will be in the allDaySlot
			obj.title = [course.c, 'Section', 'DIS - ' + (sectionNumber === null ? '?' : 'TBA')].join("\n");
			obj.number = course.num;
			obj.color = (sectionNumber === null ? 'black' : 'green');
			obj.course = course;
			obj.section = null;
			obj.start = _.state.dateMap['Monday'];
			obj.end = _.state.dateMap['Saturday'];
			_.dispatch('pushToEventSource', termId, obj);
		} else {
			for (var i = 0, days = section.t.day, length = days.length; i < length; i++) {
				obj.title = [course.c, 'Section', 'DIS - ' + section.sec].join("\n");
				obj.number = course.num;
				obj._number = sectionNumber;
				obj.color = 'grey';
				obj.course = course;
				obj.section = section;
				obj.start = _.state.dateMap[days[i]] + ' ' + section.t.time.start;
				obj.end = _.state.dateMap[days[i]] + ' ' + section.t.time.end;
				_.dispatch('pushToEventSource', termId, obj);
				obj = {};
			}
		}

		this.pushToEventSource(course, edit, sectionNumber === null ? false : true);
		this.refreshCalendar();
		$('.alertify').remove();
		return Promise.resolve();
	},
	_showInstructorRMP: function(_, firstName, lastName) {
		this.loading.go(30);
		var html = '';
		var template = function(key, value) {
			return ['<p>', '<span class="muted h6">', key, ': </span><b class="h5">', value, '</b>', '</p>'].join('');
		}
		this.fetchThreeStatsByFirstLastName(firstName, lastName)
		.then(function(rmp) {
			this.loading.go(70);
			if (rmp !== null) {
				var obj = rmp.stats.stats.quality;
				var max = Object.keys(obj).reduce(function(a, b){ return obj[a] > obj[b] ? a : b });
				html += template('Quality', firstName + ' is ' + max)
				html += template('Clarity', rmp.stats.stats.clarity.toFixed(1))
				html += template('Easy', rmp.stats.stats.easy.toFixed(1))
				html += template('Overall', rmp.stats.stats.overall.toFixed(1))
				html += template('Based on', rmp.stats.scores.count + ' ratings')
				this.alert()
				.okBtn('See it for yourself')
				.cancelBtn('Go Back')
				.confirm(html)
				.then(function(resolved) {
					resolved.event.preventDefault();
					if (resolved.buttonClicked !== 'ok') return;
					window.open('http://www.ratemyprofessors.com/ShowRatings.jsp?tid=' + rmp.tid);
				})
			}else{
				this.alert()
				.okBtn('Go Back')
				.alert(['<p>', 'Sorry, we don\'t have', firstName + '\'s', 'ratings!', '</p>'].join(' '))
			}
			this.loading.go(100);
		}.bind(this))
	},
	checkForConflict: function(_, course) {
		/*
			TODO: This method needs a more efficient rewrite
			Who the fuck write so many forLoops anyway?
		*/
		var termId = this.termId;
		var events =  _.state.events[termId];
		var intersectDays = [];
		var existingDays = [];
		var existingTimes = {};
		var comingTime = {};
		var conflict = false;
		if (typeof events === 'undefined') return false;
		for (var i = 0, length = events.length; i < length; i++) {
			// You can't take the same class twice in a quarter
			// At least you shouldn't
			if (events[i].course.c === course.c) {
				conflict = course.c;
				break;
			}
			if (events[i].allDay) continue;
			if (typeof events[i].section !== 'undefined' && events[i].section !== null) {
				existingDays.push(events[i].section.t.day);
			} else {
				existingDays.push(events[i].course.t.day);
			}
		}
		if (conflict !== false) return null;
		if (!!!course.t) {
			// TBA
			return false;
		}

		for (var i = 0, length = existingDays.length; i < length; i++) {
			if (helper.intersect(existingDays[i], course.t.day)) {
				intersectDays.push(course.t.day);
			}
		}

		intersectDays = [].concat.apply([], intersectDays).filter(function(e, i, c) {
			return c.indexOf(e) === i;
		});

		if (intersectDays.length === 0) return false;
		// O(n^2)
		// sucks
		/*

				CONSIDER NESTED LOOP HARMFUL

		*/
		for (var i = 0, length = intersectDays.length; i < length; i++) {
			for (var j = 0, events = _.state.events[termId], eLength = events.length; j < eLength; j++) {
				if (events[j].allDay) continue;
				if (typeof events[j].section !== 'undefined' && events[j].section !== null) {
					if (events[j].section.t.day.indexOf(intersectDays[i]) !== -1) {
						existingTimes[events[j].course.c + ' Section'] = events[j].section.t.time;
					}
				} else {
					if (events[j].course.t.day.indexOf(intersectDays[i]) !== -1) {
						existingTimes[events[j].course.c] = events[j].course.t.time;
					}
				}
			}
		}

		comingTime = course.t.time;
		var oldStart, newStart, oldEnd, newEnd;
		for (var code in existingTimes) {
			oldStart = existingTimes[code].start.replace(':', '');
			oldEnd = existingTimes[code].end.replace(':', '');
			newStart = comingTime.start.replace(':', '');
			newEnd = comingTime.end.replace(':', '');

			if (this.checkTimeConflict(oldStart, oldEnd, newStart, newEnd)) {
				conflict = code;
				break;
			}

		}
		return conflict;
	},
	checkTimeConflict: function(_, oldStart, oldEnd, newStart, newEnd) {
		if ((newStart > oldStart) && (newEnd > oldEnd) && (oldEnd > newStart)) {
			//console.log('new course is eating from behind')
			return true;
		}

		if ((oldEnd > newEnd) && (oldStart > newStart) && (newEnd > oldStart)) {
			//console.log('new course is eating from ahead');
			return true;
		}

		if ((newEnd == oldStart) || (newStart == oldEnd)) {
			//console.log('piggy back');
			return true;
		}

		if ((newEnd == oldEnd) || (newStart == oldStart)) {
			//console.log('overlap');
			return true;
		}

		if ((oldEnd > newEnd) && (newStart > oldStart)) {
			//console.log('new course is inside');
			return true;
		}

		if ((oldEnd < newEnd) && (newStart < oldStart)) {
			//console.log('new course is outside');
			return true;
		}
		return false;
	},
	tConvert: function(_, time) {
		// Check correct time format and split into components
		time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

		if (time.length > 1) { // If time format correct
			time = time.slice(1); // Remove full string match value
			time[5] = +time[0] < 12 ? 'AM' : 'PM'; // Set AM/PM
			time[0] = +time[0] % 12 || 12; // Adjust hours
		}
		return time.join(''); // return adjusted time or original string
	} // http://stackoverflow.com/questions/13898423/javascript-convert-24-hour-time-of-day-string-to-12-hour-time-with-am-pm-and-no
}
