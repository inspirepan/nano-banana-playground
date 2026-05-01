import { agentChatMessages } from './agentChat'
import { apiKeysMessages } from './apiKeys'
import { commonMessages } from './common'
import { configLibMessages } from './configLib'
import { imageDetailMessages } from './imageDetail'
import { inputMessages } from './input'
import { outputMessages } from './output'
import { settingsMessages } from './settings'
import type { MessageDictionary } from '../types'

export const messages: MessageDictionary = {
  ...commonMessages,
  ...inputMessages,
  ...outputMessages,
  ...apiKeysMessages,
  ...imageDetailMessages,
  ...agentChatMessages,
  ...configLibMessages,
  ...settingsMessages,
}
