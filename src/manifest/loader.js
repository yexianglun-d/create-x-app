import {
  TEMPLATES_DIR,
  loadTemplateDefinition,
  loadTemplateRegistry,
} from '../plugins/registry.js'

export { TEMPLATES_DIR }

export function loadManifest(templateKey) {
  return loadTemplateDefinition(templateKey)
}

export function loadAllManifests() {
  return loadTemplateRegistry()
}
