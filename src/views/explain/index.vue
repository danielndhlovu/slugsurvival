<template>
    <div>
        <div class="ml1 mt1 mb1">
            <router-link class="btn button-narrow mxn2 muted" :to="{ name: 'explainText' }" tag="span">?</router-link>
            <chevron-right></chevron-right>
            <span class="btn button-narrow mxn1 h5">
                Explaining Things
            </span>
        </div>
        <div class="mt1 mb1">
            <transition name="fade" mode="out-in">
                <router-view></router-view>
            </transition>
        </div>
    </div>
</template>
<script>
module.exports = {
    components: {
        chevronRight: require('../../lib/icons/chevron-right.vue')
    }
}
</script>
