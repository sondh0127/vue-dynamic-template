/* eslint-disable @typescript-eslint/no-explicit-any */
import Vue, { ComponentOptions } from 'vue'

import { isFunction, isObject, warn } from './utils'

const objCompsToArr = (objComponents: ComponentOptions<Vue>['components']) => {
  const components: Array<ComponentOptions<Vue>> = []
  for (const [key, value] of Object.entries(objComponents!)) {
    if (isObject(value)) {
      components.push(Object.assign(value, { name: key }))
    }
  }
  return components
}

const invalidMsg = (msg: string) => warn(`invalid ${msg} will be ignored!`)
const nonMsg = (msg: string) => warn(`no ${msg} found thus it will be ignored!`)

const generateField = (
  comp: ComponentOptions<Vue>,
  component: ComponentOptions<Vue>,
  type: 'filters' | 'methods' | 'mounted' | 'created' | 'computed',
) => {
  const field = comp[type]
  if (isObject(field)) {
    const wrappedField:
      | Record<string, (this: any, ...args: any[]) => any>
      | any = {}
    for (const [fieldName, method] of Object.entries(field || {})) {
      // prettier-ignore
      wrappedField[fieldName] = isFunction(method)
        ? method
        // @ts-ignore
        : Function[Array.isArray(method) ? 'apply' : 'call'](null, method)
    }
    component[type] = wrappedField
  } else if (Array.isArray(field)) {
    // @ts-ignore
    component[type] = Function[Array.isArray(field) ? 'apply' : 'call'](
      null,
      field,
    )
  } else if (field) {
    return invalidMsg(type)
  }
  return true
}

const buildComponent = (
  comps: ComponentOptions<Vue>['components'] | Array<ComponentOptions<Vue>>,
  notFirst = false,
  // eslint-disable-next-line sonarjs/cognitive-complexity
): ComponentOptions<Vue> | ComponentOptions<Vue>['components'] | void => {
  if (!comps) {
    return
  }

  if (isObject(comps)) {
    comps = objCompsToArr(comps as ComponentOptions<Vue>['components'])
  } else if (!Array.isArray(comps)) {
    return invalidMsg('components')
  }

  if (comps.length === 0) {
    return nonMsg('components')
  }

  let wrapTemp = ''
  const wrapComp: ComponentOptions<Vue>['components'] = {}

  let count = 0
  comps.forEach((comp, index) => {
    const {
      name = `Dynamic__${index}`,
      template,
      data,
      components,
      mounted,
      props,
      created,
      computed,
    } = comp

    if (!template) {
      return nonMsg('template')
    }

    wrapTemp += `<${name}${notFirst ? '' : ' v-on="$parent.$listeners"'} />`
    const component: ComponentOptions<Vue> = (wrapComp[name] = {
      template,
      mounted,
      created,
      computed,
    })

    if (
      !generateField(comp, component, 'filters') ||
      !generateField(comp, component, 'methods') ||
      !generateField(comp, component, 'mounted') ||
      !generateField(comp, component, 'created') ||
      !generateField(comp, component, 'computed')
    ) {
      return
    }

    if (data) {
      component.data = isFunction(data) ? data : () => ({ ...data })
    }
    if (props) {
      component.props = props
    }

    if (components) {
      component.components = buildComponent(
        components,
        true,
      ) as ComponentOptions<Vue>['components']
    }

    count++
  })

  if (!count) {
    return
  }

  return notFirst
    ? wrapComp
    : {
        name: 'Dynamic__Root',
        template: count === 1 ? wrapTemp : `<div>${wrapTemp}</div>`,
        components: wrapComp,
        mounted() {
          console.log('mounted, mounted, mounted')
        },
        created() {
          console.log('created, created, created')
        },
      }
}

export interface Dynamic extends Vue {
  emptyView: {}
  view: {}
  comps: ComponentOptions<Vue>['components'] | Array<ComponentOptions<Vue>>
  build: () => void
}

export const Dynamic: ComponentOptions<Dynamic> = {
  name: 'vue-dynamic',
  template: `<component :is="view" />`,
  props: {
    comps: {
      validator: (value: unknown) =>
        !value || Array.isArray(value) || isObject(value),
    },
    emptyView: {
      required: true,
      validator: (value: unknown) => isObject(value),
    },
  },
  data() {
    return {
      view: this.emptyView,
    }
  },
  // @ts-ignore
  watch: {
    comps: {
      immediate: true,
      // @ts-ignore
      handler: 'build',
    },
  },
  methods: {
    build() {
      this.view = buildComponent(this.comps) || this.emptyView
    },
  },
}
