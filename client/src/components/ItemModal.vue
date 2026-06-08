<template>
  <transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-sheet" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-stone-800">{{ item ? 'Edit gift' : 'Add gift' }}</h3>
          <button class="btn btn-ghost p-1" @click="$emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <!-- Title -->
          <div>
            <label class="form-label">Title <span class="text-red-500">*</span></label>
            <input
              v-model="form.title"
              type="text"
              class="form-input"
              placeholder="e.g. The Pragmatic Programmer"
            />
          </div>

          <!-- URL + OG fetch -->
          <div>
            <label class="form-label">Product URL</label>
            <div class="flex gap-2">
              <input
                v-model="form.url"
                type="url"
                class="form-input flex-1"
                placeholder="https://…"
                @blur="autoFetchOG"
              />
              <button class="btn btn-outline whitespace-nowrap px-3" :disabled="fetching" @click="fetchOG">
                {{ fetching ? '…' : 'Fetch details' }}
              </button>
            </div>
            <!-- OG preview -->
            <div v-if="ogPreview.title" class="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div class="flex gap-3 items-center">
                <img
                  v-if="ogPreview.image"
                  :src="ogPreview.image"
                  alt=""
                  class="w-16 h-16 rounded object-cover bg-amber-100 flex-shrink-0"
                />
                <div>
                  <p class="text-xs text-stone-500 mb-1">Suggested title:</p>
                  <p class="text-sm font-semibold text-stone-800">{{ ogPreview.title }}</p>
                  <button class="text-xs text-amber-700 font-semibold mt-1 hover:underline" @click="applyOGTitle">
                    Use this title
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Image URL -->
          <div>
            <label class="form-label">Image URL</label>
            <input
              v-model="form.og_image_url"
              type="url"
              class="form-input"
              placeholder="https://… (auto-filled from product URL)"
            />
            <div v-if="form.og_image_url" class="mt-2">
              <img
                :src="form.og_image_url"
                alt=""
                class="w-24 h-24 rounded-lg object-cover bg-stone-100"
                @error="form.og_image_url = ''"
              />
            </div>
          </div>

          <!-- Price range -->
          <div>
            <label class="form-label">Price range</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <button
                v-for="chip in PRICE_CHIPS.slice(1)"
                :key="chip.value"
                class="price-chip"
                :class="{ active: form.price_category === chip.value }"
                @click="form.price_category = chip.value"
              >
                {{ chip.label }}
              </button>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="form-label">Description</label>
            <textarea
              v-model="form.description"
              class="form-input"
              rows="2"
              style="min-height:auto;resize:vertical;"
              placeholder="Optional details about the item…"
            />
          </div>

          <!-- Buyer notes -->
          <div>
            <label class="form-label">Notes for buyer</label>
            <textarea
              v-model="form.buyer_notes"
              class="form-input"
              rows="2"
              style="min-height:auto;resize:vertical;"
              placeholder="e.g. Size M, not the Pro version, blue colourway…"
            />
          </div>

          <!-- Error -->
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

          <!-- Actions -->
          <div class="flex gap-3 pt-2">
            <button class="btn btn-outline flex-1" @click="$emit('close')">Cancel</button>
            <button class="btn btn-amber flex-1" :disabled="saving || !form.title || !form.price_category" @click="save">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from '@/api/index.js'
import { PRICE_CHIPS } from '@/utils.js'

const props = defineProps({
  show: { type: Boolean, required: true },
  item: { type: Object, default: null },
})
const emit = defineEmits(['close', 'save'])

const form = ref({})
const ogPreview = ref({ title: '', image: '' })
const fetching = ref(false)
const saving = ref(false)
const error = ref('')

watch(() => props.show, (val) => {
  if (val) {
    error.value = ''
    ogPreview.value = { title: '', image: '' }
    if (props.item) {
      form.value = {
        title: props.item.title || '',
        url: props.item.url || '',
        og_image_url: props.item.og_image_url || '',
        price_category: props.item.price_category || '',
        description: props.item.description || '',
        buyer_notes: props.item.buyer_notes || '',
      }
    } else {
      form.value = { title: '', url: '', og_image_url: '', price_category: '0_20', description: '', buyer_notes: '' }
    }
  }
})

async function fetchOG() {
  if (!form.value.url) return
  fetching.value = true
  try {
    const result = await api.items.enrich(form.value.url)
    if (result.title) ogPreview.value.title = result.title
    if (result.og_image_url) {
      ogPreview.value.image = result.og_image_url
      if (!form.value.og_image_url) form.value.og_image_url = result.og_image_url
    }
  } catch {
    // silent
  } finally {
    fetching.value = false
  }
}

let lastAutoFetchUrl = ''
async function autoFetchOG() {
  const url = form.value.url
  if (!url || url === lastAutoFetchUrl) return
  lastAutoFetchUrl = url
  await fetchOG()
}

function applyOGTitle() {
  if (ogPreview.value.title) form.value.title = ogPreview.value.title
}

async function save() {
  if (!form.value.title || !form.value.price_category) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      title: form.value.title.trim(),
      url: form.value.url || null,
      og_image_url: form.value.og_image_url || null,
      price_category: form.value.price_category,
      description: form.value.description || null,
      buyer_notes: form.value.buyer_notes || null,
    }

    if (props.item) {
      const updated = await api.items.update(props.item.id, payload)
      emit('save', updated)
    } else {
      const created = await api.items.create(payload)
      emit('save', created)
    }
    emit('close')
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>
