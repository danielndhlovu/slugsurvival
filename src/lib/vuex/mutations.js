module.exports = {
	setTitle: function(state, title) {
		state.title = title;
	},
	setTermName: function(state, name) {
		state.termName = name;
	},
	saveTermsList: function(state, terms) {
		state.flatTermsList = terms;
		terms.forEach(function(term) {
			state.termsList[term.code] = term.name;
		})
	},
	saveTermCourses: function(state, termId, courses) {
		state.courses[termId] = courses;
		if (typeof state.flatCourses[termId] === 'undefined') {
			state.flatCourses[termId] = [];
		}
		var obj;
		Object.keys(courses).forEach(function(subject) {
			courses[subject].forEach(function(course) {
				obj = course;
				obj.code = [subject, course.code].join(' ');
				state.flatCourses[termId].push(obj);
			})
		})
	},
	saveCourseInfo: function(state, termId, courses) {
		state.courseInfo[termId] = courses;
	},
	pushToEventSource: function(state, termId, obj) {
		if (typeof state.events[termId] === 'undefined') state.events[termId] = [];
		state.events[termId].push(obj);
	},
	restoreEventSourceSnapshot: function(state, termId, events) {
		state.events[termId] = events;
	},
	removeFromSource: function(state, termId, number) {
		state.events[termId] = state.events[termId].filter(function(event) {
			return event.number !== number;
		})
	}
}
