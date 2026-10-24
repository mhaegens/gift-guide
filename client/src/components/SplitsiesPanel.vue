<template>
  <div v-if="item.splitsies || (expanded && !item.is_claimed)" class="px-3 pb-3">
    <div v-if="group" class="rounded-xl bg-violet-50 border border-violet-100 p-3">
      <p class="text-sm font-semibold text-violet-900">{{ group.starter_name }} wants to go splitsies</p>
      <p class="text-xs text-violet-700 mt-1">{{ group.participants.map(p => p.display_name + (p.is_me ? ' (you)' : '')).join(' · ') }}</p>
      <p class="text-sm font-semibold text-violet-900 mt-2">
        {{ formatMoney(group.total_cents) }} pledged<span v-if="group.target_cents"> of {{ formatMoney(group.target_cents) }}</span>
      </p>
      <template v-if="group.target_cents">
        <div class="h-2 bg-violet-100 rounded-full overflow-hidden mt-2" role="progressbar" :aria-valuenow="group.total_cents" :aria-valuemax="group.target_cents" aria-valuemin="0" aria-label="Gift sponsorship">
          <div class="h-full bg-violet-500" :style="{ width: Math.min(100, group.total_cents / group.target_cents * 100) + '%' }" />
        </div>
        <p class="text-xs text-violet-700 mt-1">{{ group.remaining_cents === 0 ? 'Fully sponsored!' : formatMoney(group.remaining_cents) + ' left to sponsor' }}</p>
      </template>
      <template v-if="expanded">
        <ul class="mt-3 space-y-2">
          <li v-for="person in group.participants" :key="person.user_id" class="text-sm text-violet-900">
            <div class="flex justify-between gap-2"><span>{{ person.display_name }}{{ person.is_me ? ' (you)' : '' }}</span><strong>{{ formatMoney(person.amount_cents) }}</strong></div>
            <p v-if="person.note" class="text-xs text-violet-700 whitespace-pre-line break-words mt-0.5">{{ person.note }}</p>
          </li>
        </ul>
        <div v-if="!editing" class="flex flex-wrap gap-2 mt-3">
          <button v-if="mine || group.remaining_cents !== 0" class="btn btn-outline text-xs flex-1" :disabled="busy" @click="openForm">{{ mine ? 'Change my contribution' : 'Join splitsies' }}</button>
          <button v-if="mine" class="btn btn-ghost text-xs" :disabled="busy" @click="leave">{{ busy ? 'Leaving…' : 'Leave splitsies' }}</button>
        </div>
      </template>
    </div>
    <button v-else-if="!editing" class="btn btn-outline w-full text-sm" @click="openForm">Go splitsies</button>

    <form v-if="editing && expanded" class="mt-3 space-y-3" @submit.prevent="save">
      <p class="text-sm font-semibold text-stone-800">{{ group ? (mine ? 'Your contribution' : 'Join this gift') : 'Start splitsies' }}</p>
      <div v-if="!group">
        <label :for="`split-target-${item.id}`" class="form-label">Gift total (€) · optional</label>
        <input :id="`split-target-${item.id}`" v-model="target" class="form-input" type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" placeholder="e.g. 120" />
      </div>
      <div>
        <label :for="`split-amount-${item.id}`" class="form-label">Your contribution (€)</label>
        <input :id="`split-amount-${item.id}`" v-model="amount" class="form-input" type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" placeholder="e.g. 30" required />
      </div>
      <div>
        <label :for="`split-note-${item.id}`" class="form-label">What are you sponsoring? · optional</label>
        <input :id="`split-note-${item.id}`" v-model="note" class="form-input" maxlength="300" placeholder="e.g. The controller, or part of the gift" />
      </div>
      <p class="text-xs text-stone-500">The group can see names and contributions. Everything stays hidden from the recipient. Arrange payment together.</p>
      <div class="flex gap-2">
        <button type="button" class="btn btn-outline flex-1" :disabled="busy" @click="editing = false">Cancel</button>
        <button type="submit" class="btn btn-amber flex-1" :disabled="busy">{{ busy ? 'Saving…' : group ? 'Save contribution' : 'Start splitsies' }}</button>
      </div>
    </form>
    <p v-if="error" role="alert" class="text-sm text-red-600 mt-2">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import { api } from '@/api/index.js'
import { formatMoney } from '@/utils.js'

const props = defineProps({ item: { type: Object, required: true }, expanded: Boolean })
const emit = defineEmits(['updated'])
const showToast = inject('showToast')
const group = computed(() => props.item.splitsies)
const mine = computed(() => group.value?.participants.find(p => p.is_me))
const editing = ref(false)
const busy = ref(false)
const amount = ref('')
const target = ref('')
const note = ref('')
const error = ref('')

function openForm() {
  amount.value = mine.value ? (mine.value.amount_cents / 100).toFixed(2) : ''
  note.value = mine.value?.note || ''
  target.value = ''
  error.value = ''
  editing.value = true
}

async function handleError(err) {
  error.value = err.message || 'Could not update splitsies'
  if (err.status === 409) {
    try { emit('updated', await api.splitsies.get(props.item.id)) } catch {}
  }
}

async function save() {
  busy.value = true
  error.value = ''
  try {
    const data = { amount: String(amount.value), note: note.value, target: String(target.value) }
    const updated = group.value ? await api.splitsies.join(props.item.id, data) : await api.splitsies.start(props.item.id, data)
    editing.value = false
    emit('updated', updated)
    showToast?.('Your contribution is saved')
  } catch (err) { await handleError(err) }
  finally { busy.value = false }
}

async function leave() {
  busy.value = true
  error.value = ''
  try {
    emit('updated', await api.splitsies.leave(props.item.id))
    showToast?.('You left splitsies')
  } catch (err) { await handleError(err) }
  finally { busy.value = false }
}
</script>
