import { invokeOpenAIResponses, probeOpenAIResponses } from './openai-responses.mjs';
import { invokeOpenAIChat, probeOpenAIChat } from './openai-chat.mjs';
import { invokeAnthropicMessages, probeAnthropicMessages } from './anthropic-messages.mjs';
import { invokeGemini, probeGemini } from './gemini.mjs';
import { invokeCommand, probeCommand } from './command.mjs';
const adapters={'openai-responses':{invoke:invokeOpenAIResponses,probe:probeOpenAIResponses},'openai-chat':{invoke:invokeOpenAIChat,probe:probeOpenAIChat},'anthropic-messages':{invoke:invokeAnthropicMessages,probe:probeAnthropicMessages},'gemini-generate-content':{invoke:invokeGemini,probe:probeGemini},command:{invoke:invokeCommand,probe:probeCommand}};
export function getAdapter(type){const adapter=adapters[type];if(!adapter)throw new Error(`Unsupported adapter type: ${type}`);return adapter;}
export function adapterTypes(){return Object.keys(adapters);}
