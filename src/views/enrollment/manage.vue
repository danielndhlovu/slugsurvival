<template>
    <div>
        <div class="overflow-hidden bg-white rounded mb2" v-if="ready">
			<div class="m0 p1">
				<div class="clearfix">
					<span class="btn black h5">Manage Your Subscription</span>
				</div>
				<div class="clearfix">
                    <span class="ml1 btn black h6 muted not-clickable">
                        To manage your notification subscription, login with your phone number/emails and your passcode.
                    </span>
				</div>
			</div>
			<div class="m0 p2 border-top" v-show="!sub.verified">
				<div class="clearfix">
                    <span class="btn black h6 not-clickable">
                        <form v-on:submit.prevent="returnFalse" class="h6">
                            <label for="term" class="block mb2">
                                <select class="col-12 inline-block" id="quarters"></select>
                            </label>
                            <label for="recipient" class="block">
                                <input type="text" class="col-12 field inline-block" v-model="sub.recipient" placeholder="phone/email">
                            </label>
                            <label for="code" class="mt2 block">
                                <input type="text" class="col-12 field inline-block" v-model="sub.code" placeholder="passcode">
                            </label>
                            <label for="submit" class="mt2 inline-block">
                                <button @click="checkSub" class="btn btn-outline inline-block white" v-bind:style="{ backgroundColor: colorMap.regular }" :disabled="sub.inFlight">Check</button>
                            </label>
                            <label for="submit" class="ml1 mt2 inline-block">
                                <button @click="sub.modal = true" class="btn btn-outline inline-block black" v-bind:style="{ backgroundColor: colorMap.blank }" :disabled="sub.inFlight">Reset Passcode</button>
                            </label>
        				</form>
                    </span>
				</div>
			</div>
            <div class="m0 p1 border-top" v-show="sub.verified">
                <div class="m0 p2">
                    <div class="clearfix">
                        <div class="sm-flex">
                            <div class="p1 flex m1 h6 btn white clickable" v-bind:style="{ backgroundColor: colorMap.searchAnything }" @click="showSearchModal"><i class="fa fa-search fa-lg">&nbsp;</i>search anything</div>
                        </div>
                    </div>
                </div>
                <div class="clearfix">
                    <span class="btn black h5">For {{ termName }}: </span>
				</div>
				<div class="clearfix">
                    <table class="h6 col col-12">
                        <tr v-for="course in courses" :key="course.num">
                            <td class="col col-6">
                                <span class="btn clickable left" @click="showCourse(termCode, course)">{{ course.c }} - {{ course.s }}</span>
                            </td>
                        </tr>
                        <tr v-show="courses.length === 0">
                            <td class="col col-6">
                                <span class="btn not-clickable left muted">(none)</span>
                            </td>
                        </tr>
					</table>
				</div>
			</div>
            <div class="m0 p1 border-top" v-show="sub.verified">
                <div class="clearfix">
                    <span class="btn black h5">What would you like to do?</span>
                </div>
                <div class="m0 p2">
    				<div class="clearfix">
                        <button type="button" class="h6 ml1 mb1 bold btn btn-outline white" v-bind:style="{ backgroundColor: colorMap.regular }" :disabled="sub.inFlight" @click="update">Update Subscription</button>
                        <button type="button" class="h6 ml1 mb1 bold btn btn-outline white" v-bind:style="{ backgroundColor: colorMap.alert }" :disabled="sub.inFlight" @click="unSub">Unsubscribe Me</button>
    				</div>
                </div>
			</div>
		</div>
        <search :show="searchModal" v-on:close="searchModal = false" :callback="addToNotifyList" :selected-term-id="termCode"></search>
        <modal :show="sub.modal" v-on:close="sub.modal = false">
			<h4 slot="header">Reset Your Passcode</h4>
			<span slot="body">
				<form v-on:submit.prevent class="h5">
                    <label for="recipient" class="mt2 block">
                        <input type="text" class="col-8 mb1 field inline-block" v-model="sub.recipient" placeholder="phone number or email">
                        <button type="submit" class="col-3 btn ml1 mb1 inline-block black" :disabled="sub.verified || sub.inFlight" @click="codeResend">Get code</button>
                    </label>
                    <span class="btn black h6 muted not-clickable" v-show="!sub.sent">
                        Please include country code for your phone number. <br />
                        For example: 18314590111
                    </span>
				</form>
			</span>
		</modal>
    </div>
</template>

<script>
var config = require('../../../config')
var request = require('superagent')

module.exports = {
    data: function() {
        return {
            ready: false,
            searchModal: false,
            availableTerms: [],
            termCode: null,
            selectizeRef: null,
            courses: [],
            sub: {
                modal: false,
                recipient: '',
                code: '',
                inFlight: false,
                verified: false
            }
        }
    },
    computed: {
        alert: function() {
            return this.$store.getters.alert;
        },
        termId: function() {
            return this.$store.getters.termId;
        },
        colorMap: function() {
            return this.$store.getters.colorMap;
        },
        color: function() {
            return this.$store.getters.color;
        },
        flatCourses: function() {
            return this.$store.getters.flatCourses;
        },
        termName: function() {
            return this.$store.getters.termName;
        },
        termDates: function() {
            return this.$store.getters.termDates;
        }
    },
    watch: {
        'termCode': function(val, oldVal) {
            if (!this.ready) return;
            this.termCode = val;
            this.switchTerm(oldVal);
        }
    },
    methods: {
        returnFalse: function() {
            return false
        },
        showSearchModal: function() {
            this.searchModal = true;
            setTimeout(function() {
                document.getElementsByClassName('search-box')[0].focus();
            }, 75);
        },
        addToNotifyList: function(course) {
            var self = this;
            if (self.courses.length + 1 > 4) {
                self.alert.error('Cannot subscribe for more than 4 courses.')
                if (self.$store.getters.Tracker !== null) {
                    self.$store.getters.Tracker.trackEvent('enrollment', 'greedy');
                }
                return
            }

            if (self.courses.filter(function(obj) {
                return obj.num === course.num
            }).length > 0) {
                return self.alert.error('Duplicate courses.')
            }
            
            return self.$store.dispatch('getCourseDom', {
                termId: self.termCode,
                courseObj: course,
                isSection: false
            })
            .then(function(html) {
                return self.alert
                .okBtn('Notify')
                .cancelBtn("Go Back")
                .confirm(html)
                .then(function(resolved) {
                    resolved.event.preventDefault();
                    if (resolved.buttonClicked !== 'ok') return;
                    self.alert.success(course.c + ' added to the list!');
                    self.courses.push(course);
                    if (self.$store.getters.Tracker !== null) {
                        self.$store.getters.Tracker.trackEvent('enrollment', 'add', self.termCode + '_' + course.num)
                    }
                });
            })
        },
        update: function() {
            var self = this;
            self.$store.dispatch('showSpinner')
            self.sub.inFlight = true;
            return self.$store.dispatch('updateWatch', {
                recipient: self.sub.recipient,
                code: self.sub.code,
                courses: self.courses,
                termId: self.termCode
            })
            .then(function() {
                self.$store.dispatch('hideSpinner')
                self.sub.inFlight = false;
                self.alert.success('Subscription list updated.');
                if (self.$store.getters.Tracker !== null) {
                    self.$store.getters.Tracker.trackEvent('updateWatch', 'update_courses', self.courses.map(function(el) { return el.c; }).join(','));
                }
            })
        },
        unSub: function() {
            var self = this;
            self.$store.dispatch('showSpinner')
            return request.post(config.notifyURL + '/unsubscribe')
            .send({
                recipient: self.sub.recipient,
                code: parseInt(self.sub.code),
                termId: parseInt(self.termCode)
            })
            .ok(function(res) {
                return true
            })
            .then(function(res) {
                return res.body
            })
            .then(function(res) {
                self.$store.dispatch('hideSpinner')
                if (res.ok !== true) {
                    return self.alert.error(res.message || 'An error has occured.');
                }
                if (self.$store.getters.Tracker !== null) {
                    self.$store.getters.Tracker.trackEvent('unsubscribe', 'recipient', self.sub.recipient);
                }
                self.$store.dispatch('hideSpinner')
                self.sub.inFlight = false;
                self.alert.success('Unsubscribed. You will no longer receive notifications.');
                self.$router.push({ name: 'enrollHelper'})
            })
        },
        checkSub: function() {
            var self = this;
            self.$store.dispatch('showSpinner')
            self.sub.inFlight = true;
            return request.post(config.notifyURL + '/getCourses')
            .send({
                recipient: self.sub.recipient,
                code: parseInt(self.sub.code),
                termId: parseInt(self.termCode)
            })
            .ok(function(res) {
                return true
            })
            .then(function(res) {
                return res.body
            })
            .then(function(res) {
                if (res.ok !== true) {
                    self.$store.dispatch('hideSpinner')
                    self.sub.inFlight = false;
                    return self.alert.error(res.message || 'An error has occured.');
                }
                self.$store.dispatch('hideSpinner')
                self.sub.verified = true;
                self.sub.inFlight = false;
                self.courses = res.courses.map(function(num) {
                    return self.flatCourses[self.termCode][num]
                });
            })
        },
        codeResend: function() {
            var self = this;
            self.$store.dispatch('showSpinner')
            self.sub.inFlight = true;
            return request.post(config.notifyURL + '/codeResend')
            .send({
                recipient: self.sub.recipient,
                termId: parseInt(self.termCode)
            })
            .ok(function(res) {
                return true
            })
            .then(function(res) {
                return res.body
            })
            .then(function(res) {
                if (res.ok !== true) {
                    self.$store.dispatch('hideSpinner')
                    self.sub.inFlight = false;
                    return self.alert.error(res.message || 'An error has occured.');
                }
                if (self.$store.getters.Tracker !== null) {
                    self.$store.getters.Tracker.trackEvent('codeResend', 'recipient', self.sub.recipient);
                }
                self.$store.dispatch('hideSpinner')
                self.sub.inFlight = false;
                self.sub.modal = false;
                self.alert.success('A new passcode has been sent.');
            })
        },
        showCourse: function(termId, course) {
            var self = this;

            try {
                if (self.$store.getters.Tracker !== null) {
                    self.$store.getters.Tracker.trackEvent('enrollment', 'click', termId + '_' + course.num)
                }
            }catch(e) {}

            return self.$store.dispatch('getCourseDom', {
                termId: termId,
                courseObj: course,
                isSection: false
            })
            .then(function(html) {
                return self.alert
                .okBtn('Remove Class')
                .cancelBtn("Go Back")
                .confirm(html)
                .then(function(resolved) {
                    resolved.event.preventDefault();
                    if (resolved.buttonClicked !== 'ok') return;
                    return self.alert
                    .okBtn("Yes")
                    .cancelBtn("No")
                    .confirm('Remove ' + course.c + ' from the list?')
                    .then(function(resolved) {
                        resolved.event.preventDefault();
                        if (resolved.buttonClicked !== 'ok') return;
                        self.removeFromList(course);
                        self.alert.success('Removed!');
                        if (self.$store.getters.Tracker !== null) {
                            self.$store.getters.Tracker.trackEvent('enrollment', 'remove', termId + '_' + course.num)
                        }
                    });
                });
            })
        },
        removeFromList: function(course) {
            this.courses = this.courses.filter(function(el) {
                return el.num !== course.num
            })
        },
        switchTerm: function(oldTermCode) {
            var self = this;
            self.courses = [];
            self.$store.dispatch('showSpinner')
            self.$store.commit('setTermName', null)
            if (!!oldTermCode) self.$store.commit('emptyTerm', oldTermCode)
            self.$store.commit('setTermName', self.$store.getters.termsList[self.termCode])
            return self.$store.dispatch('fetchTermCourses', self.termCode).then(function() {
                self.$store.dispatch('hideSpinner')
            })
        },
        initSelectize: function() {
            var self = this;
            this.selectizeRef = $('#quarters').selectize({
                options: self.availableTerms.map(function(term) {
                    return { text: term.name, value: term.code }
                }),
                placeholder: 'select a quarter...',
                dropdownParent: "body",
                hideSelected: true,
                onChange: function(val) {
                    self.termCode = val;
                },
                render: {
                    option: function(item, escape) {
                        return '<div class="h6">' + escape(item.text) + '</div>';
                    },
                    item: function(item, escape) {
                        return '<div class="h6 inline-block">' + escape(item.text) + '</div>';
                    }
                }
            })
        }
    },
    mounted: function() {
        var self = this;
        this.$store.dispatch('setTitle', 'Manage');

        return self.$store.dispatch('fetchAvailableTerms')
        .then(function(list) {
            self.availableTerms = list.filter(function(term) {
                return self.termDates[term.code].start !== null;
            });
            self.termCode = self.availableTerms[self.availableTerms.length - 1].code;
            return self.switchTerm();
        })
        .then(function() {
            self.ready = true;
            self.$nextTick(function() {
                self.initSelectize()
                // TODO: don't hard code this
                $('#quarters-selectized').prop('readonly', true)
                self.selectizeRef[0].selectize.setValue(self.termCode)
                self.$store.dispatch('hideSpinner')
            })
        })
    },
    beforeDestroy: function() {
        // garbage collection
        this.selectizeRef[0].selectize.destroy()
    }
}
</script>
