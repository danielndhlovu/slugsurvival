<template>
    <div>
        <div class="mt1 mb1">
            <div class="overflow-hidden bg-white rounded mb2">
                <div class="m0 p1">
                    <div class="clearfix">
                        <a class="btn black h4">Quick Search:</a>
                    </div>
                    <div class="clearfix">
                        <span class="ml2 btn muted not-clickable">
                            <span class="h5 black">Look up the current classes by code, and view classes from the past quarters.</span> <span @click="showGE" class="h6 red clickable">How To Search by GE?</span>
                        </span>
                    </div>
                </div>
                <div class="m0 p2 border-top">
                    <div class="clearfix">
                        <input
                            type="text"
                            style="border: 0 !important"
                            class="field black block col col-12 mb2 search-box"
                            v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }"
                            v-model="search.string"
                            placeholder="e.g. EE 177, +CC, ECON +PE-H, ..."
                            onmouseover="this.focus()"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="off"
                            spellcheck="false"
                        >
                        <div
                            class="ml1 block"
                            v-show="search.insufficient && search.code.length > 0"
                            v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }"
                        >
                            ...Need two or more characters
                        </div>
                        <div
                            class="ml1 block"
                            v-show="!search.insufficient && search.dirty"
                            v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }"
                        >
                            ...Typing
                        </div>
                        <div class="overflow-scroll col col-12 block" v-show="search.results.length > 0 && !search.dirty">
                            <table class="table-light">
                                <thead class="bg-silver h6">
                                    <th>Course</th>
                                    <th>Quarter</th>
                                    <th>Current</th>
                                    <th>Past</th>
                                    <!--<th>Likely Be Offered</th>
                                    <th>Frequency</th>-->
                                </thead>
                                <tbody v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }">
                                    <tr v-for="result in search.results" v-bind:class="{ 'bg-darken-1': result.darken }">
                                        <td class="nowrap clickable" @click="promptShowCourse(result, result.occur[0])">{{ result.code }}</td>
                                        <td class="nowrap clickable" @click="promptShowCourse(result, result.occur[0])">{{ result.qtr }}</td>
                                        <td class="nowrap clickable" @click="promptShowCourse(result, result.occur[0])">{{ result.occur[0] }}</td>
                                        <td class="nowrap">
                                            <span
                                                v-for="(year, index) in result.occur.slice(1)"
                                                @click="promptShowCourse(result, year)"
                                                class="clickable rainbow"
                                            >
                                                {{ year }}{{ index < result.occur.length - 2 ? ', ' : '' }}
                                            </span>
                                        </td>
                                        <!--<td>{{ result.pos }}</td>
                                        <td>{{ result.fre }}</td>-->
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div
                            class="ml1 col col-12 block"
                            v-show="
                                (search.geCode.length > 0 || search.code.length >= 2)
                                && search.results.length === 0 && !search.dirty
                                "
                            v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }"
                        >
                            No results.
                        </div>
                    </div>
                </div>
            </div>
            <div class="overflow-hidden bg-white rounded mb2">
                <div class="m0 p1">
                    <div class="clearfix">
                        <span class="btn black h4">Class Related: </span>
                    </div>
                    <div class="clearfix">
                        <span class="ml1 btn black h5 muted not-clickable">Here are the tools to help you get through registration faster.</span>
                    </div>
                </div>
                <div class="m0 p2 border-top">
                    <div class="clearfix">
                        <div class="md-flex" v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }">
                            <router-link class="p2 flex-auto m1 white clickable btn-outline" v-bind:style="{ backgroundColor: colorMap.alert }" :to="{ name: 'termsList' }" tag="div"><i class="fa fa-calendar fa-2x">&nbsp;</i>Interactive Quarter Planner</router-link>
                            <router-link class="p2 flex-auto m1 white clickable btn-outline" v-bind:style="{ backgroundColor: colorMap.regular }" :to="{ name: 'advMenu' }" tag="div"><i class="fa fa-check fa-2x">&nbsp;</i>Academic Career Advisory</router-link>
                            <router-link class="p2 flex-auto m1 white clickable btn-outline" v-bind:style="{ backgroundColor: colorMap.regular }" :to="{ name: 'enrollHelper' }" tag="div"><i class="fa fa-bell fa-2x">&nbsp;</i>Notify Me When My Classes Are Open</router-link>
                        </div>
                    </div>
                </div>
            </div>
            <div class="overflow-hidden bg-white rounded mb2">
                <div class="m0 p1">
                    <div class="clearfix">
                        <span class="btn black h4">Nerd Stats: </span>
                    </div>
                    <div class="clearfix">
                        <span class="ml1 btn black h5 muted not-clickable">Because we all love data.</span>
                    </div>
                </div>
                <div class="m0 p2 border-top">
                    <div class="clearfix">
                        <div class="sm-flex" v-bind:class="{ 'h6': isMobile, 'h5': !isMobile }">
                            <router-link class="p2 flex-auto m1 white clickable btn-outline" v-bind:style="{ backgroundColor: colorMap.regular }" :to="{ name: 'analyticsCourse' }" tag="div"><i class="fa fa-line-chart fa-2x">&nbsp;</i>Enrollment Analytics</router-link>
                            <router-link class="p2 flex-auto m1 white clickable btn-outline" v-bind:style="{ backgroundColor: colorMap.regular }" :to="{ name: 'analyticsRealtime' }" tag="div"><i class="fa fa-exchange fa-2x">&nbsp;</i>Analytics in Realtime</router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <modal :show="GEModal" :do-not-modify-class="true" v-on:close="GEModal = false">
            <h4 slot="header">
                How do I search by GE?
            </h4>
            <span slot="body">
                <ul class="list-reset">
                    <p>
                        Just add a plus sign(+) followed by the code, like this:
                    </p>
                    <p>
                        <input type="text" class="field block col-10" disabled value="+CC">
                    </p>
                    <p>
                        <input type="text" class="field block col-10" disabled value="CLTE +C2">
                    </p>
                    <p>
                        Let's give you a reminder of what GEs do we have...
                    </p>
                    <li class="overflow-hidden btn h5 block" v-on:click.prevent.stop="" v-for="(code, desc) in listOfGE">
                        {{ code }} - {{ desc }}
                    </li>
                </ul>
            </span>
        </modal>
    </div>
</template>
<script>
var debounce = require('lodash.debounce')
var helper = require('../lib/vuex/helper')
module.exports = {
    data: function() {
        return {
            inFlight: false,
            isMobile: false,
            listOfGE: {},
            GEModal: false,
            search: {
                geCode: '',
                code: '',
                string: '',
                results: [],
                insufficient: false,
                dirty: false
            }
        }
    },
    computed: {
        alert: function() {
            return this.$store.getters.alert;
        },
        title: function() {
            return this.$store.getters.title;
        },
        colorMap: function() {
            return this.$store.getters.colorMap;
        },
        numOfYears: function() {
            return this.$store.getters.numOfYears
        },
        historicData: function() {
            return this.$store.getters.historicData;
        },
        historicFrequency: function() {
            return this.$store.getters.historicFrequency;
        },
        sortedCourses: function() {
            return this.$store.getters.sortedCourses;
        },
        flatCourses: function() {
            return this.$store.getters.flatCourses;
        }
    },
    methods: {
        promptShowCourse: function(result, year) {
            if (year === '...') return
            if (this.inFlight) {
                this.alert.maxLogItems(1).error('Loading, please wait...')
                return
            }
            var self = this;
            self.inFlight = true
            self.$store.dispatch('showSpinner')
            var quarter = result.qtr;
            var termId = helper.nameToCode([year, quarter].join(' '))

            var department = result.code.slice(0, result.code.indexOf(' '))
            var number = result.code.slice(result.code.indexOf(' ') + 1, result.code.lastIndexOf('-') - 1)
            var section = result.code.slice(result.code.lastIndexOf('-') + 2)

            return self.$store.dispatch('fetchTermCourses', termId)
            .then(function() {
                try {
                    var course = self.sortedCourses[termId][department].filter(function(course) {
                        return course.c === [department, number].join(' ') && course.s === section;
                    })[0];
                }catch (e) {
                    console.log(e)
                    self.$store.dispatch('hideSpinner')
                    return;
                }

                if (self.$store.getters.Tracker !== null) {
                    self.$store.getters.Tracker.trackEvent('quickSearchCb', 'clicked', termId + '_' + course.c + '-' + course.s)
                }

                return self.$store.dispatch('getCourseDom', {
                    termId: termId,
                    courseNum: course.num,
                    courseObj: course,
                    isSection: false,
                    showQuarterYear: true
                }).then(function(html) {
                    self.$store.dispatch('hideSpinner')
                    return self.alert
                    .okBtn('OK')
                    .alert(html)
                    .then(function(resolved) {
                        resolved.event.preventDefault();
                        if (self.$store.getters.Tracker !== null) {
                            self.$store.getters.Tracker.trackEvent('quickSearchCb', 'back', termId + '_' + course.c + '-' + course.s)
                        }
                        self.$store.commit('emptyTerm', termId)
                    })
                })
            })
            .finally(function() {
                self.inFlight = false
            })

        },
        groupBy: function(xs, key) {
            return xs.reduce(function(rv, x) {
                (rv[x[key]] = rv[x[key]] || []).push(x);
                return rv;
            }, {});
        },
        showGE: function() {
            var self = this;
            return this.$store.dispatch('fetchGE')
            .then(function(ge) {
                self.listOfGE = ge;
                self.GEModal = true;
            })
        },
        findHistorical: debounce(function() {
            var self = this;
            var results = [];
            if (this.search.insufficient) return;
            // TODO: let's not brute force it
            if (this.search.geCode === '') {
                for (var quarter in this.historicData){
                    if (quarter === 'ge') continue;
                    for (var code in this.historicData[quarter]) {
                        if (code.toLowerCase().replace(/\s/g, '').indexOf(this.search.code.toLowerCase().replace(/\s/g, '')) !== -1) {
                            var keys = Object.keys(this.historicData[quarter][code]);
                            results.push({
                                department: code.slice(0, code.indexOf(' ')),
                                number: code.slice(code.indexOf(' ') + 1, code.lastIndexOf('-') - 1),
                                section: code.slice(code.lastIndexOf('-') + 2),
                                code: code,
                                qtr: quarter.charAt(0).toUpperCase() + quarter.slice(1),
                                //pos: self.historicFrequency[quarter].indexOf(code) !== -1 ? 'Yes' : 'No',
                                //fre: keys.length + '/' + this.numOfYears,
                                occur: keys.length > 5 ? keys.reverse().slice(0, 5).concat('...')/*.join(', ') + '...'*/ : keys.reverse()/*.join(', ')*/
                            })
                        }
                    }
                }
            }else{
                if (typeof this.historicData.ge !== 'undefined') {
                    // TODO: Extremely inefficient
                    for (var geQuarter in this.historicData.ge) {
                        if (typeof this.historicData.ge[geQuarter][this.search.geCode] === 'undefined') continue
                        for (var code in this.historicData.ge[geQuarter][this.search.geCode]) {
                            if (code.toLowerCase().replace(/\s/g, '').indexOf(this.search.code.toLowerCase().replace(/\s/g, '')) !== -1) {
                                var keys = Object.keys(this.historicData.ge[geQuarter][this.search.geCode][code]);
                                results.push({
                                    department: code.slice(0, code.indexOf(' ')),
                                    number: code.slice(code.indexOf(' ') + 1, code.lastIndexOf('-') - 1),
                                    section: code.slice(code.lastIndexOf('-') + 2),
                                    code: code,
                                    qtr: geQuarter.charAt(0).toUpperCase() + geQuarter.slice(1),
                                    //pos: self.historicFrequency[geQuarter].indexOf(code) !== -1 ? 'Yes' : 'No',
                                    //fre: keys.length + '/' + this.numOfYears,
                                    occur: keys.length > 5 ? keys.reverse().slice(0, 5).concat('...')/*.join(', ') + '...'*/ : keys.reverse()/*.join(', ')*/
                                })
                            }
                        }
                    }
                }
            }
            var _results = [];
            var darken = false
            var groupByDepartment = this.groupBy(results, 'department');
            var groupByNumber = []
            var groupBySection = []
            for (var department in groupByDepartment) {
                groupByNumber = this.groupBy(groupByDepartment[department], 'number')
                for (var number in groupByNumber) {
                    groupBySection = this.groupBy(groupByNumber[number], 'section')
                    for (var section in groupBySection) {
                        groupBySection[section].forEach(function(result) {
                            result.darken = darken
                            _results.push(result)
                        })
                        darken = !darken
                    }
                    /*groupByNumber[number].forEach(function(result) {
                        result.darken = darken
                        _results.push(result)
                    })
                    darken = !darken*/
                }
            }
            this.search.results = _results;
            this.search.dirty = false;
            if (this.$store.getters.Tracker !== null) {
                this.$store.getters.Tracker.trackSiteSearch(this.search.code + (this.search.geCode !== '' ? ';' + this.search.geCode : ''), 'findHistorical', this.search.results.length)
            }
        }, 1250)
    },
    watch: {
        'search.string': function(val, oldVal) {
            if (val.indexOf('+') !== -1) {
                this.search.geCode = val.substring(val.indexOf('+') + 1).substring(0, 4).trim().toUpperCase();
                this.search.code = val.substring(0, val.indexOf('+')).trim();;
            }else{
                this.search.code = val
            }
            if (val === '') {
                this.search.code = ''
                this.search.geCode = ''
            }
            if (this.search.code.length < 2 && this.search.geCode === '') {
                this.search.results = [];
                this.search.insufficient = true;
                this.search.dirty = false;
                return;
            }
            this.search.insufficient = false;
            this.search.dirty = true;
            this.findHistorical();
        }
    },
    mounted: function() {
        this.$store.dispatch('setTitle', 'Main')
        this.$nextTick(function() {
            this.$store.dispatch('hideSpinner')
        })
    },
    created: function() {
        this.isMobile = this.$store.getters.MobileDetect.phone()
    }
}
</script>
