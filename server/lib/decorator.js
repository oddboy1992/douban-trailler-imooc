const Router = require('koa-router')
const symbolPrefix = Symbol('prefix')
const glob = require('glob')
const routerMap = new Map()
const _ = require('lodash')
const { resolve } = require('path')

export const isArray = c => (_.isArray(c) ? c : [c])

export class Route {
  constructor (app, apiPath) {
    this.app = app
    this.apiPath = apiPath
    this.router = new Router()
  }

  // 加载每一个路由文件 初始化每一个路由控制器
  init() {
    glob.sync(resolve(this.apiPath, './**/*.js')).forEach(path => require(path))

    for (let [conf, controller] of routerMap) {
      const controllers = isArray(controller)
      let prefixPath = conf.target[symbolPrefix]

      if (prefixPath) prefixPath = normalizePath(prefixPath)
      const routerPath = prefixPath + conf.path
      // this.router.post('/api/v0/movies', funcA, funcB)
      // Multiple middleware 这里的多个路由困扰了我好久
      this.router[conf.method](routerPath, ...controllers)
    }

    this.app.use(this.router.routes())
    this.app.use(this.router.allowedMethods())
  }
}

export const normalizePath = path => path.startsWith('/') ? path : `/${path}`

export const controller = path => target => {
  return target.prototype[symbolPrefix] = path
}

export const router = conf => (target, key, descriptor) => {
  conf.path = normalizePath(conf.path)

  routerMap.set({
    target,
    ...conf,
  }, target[key])
}

export const get = path => router({
  method: 'get',
  path: path,
})

export const post = path => router({
  method: 'post',
  path: path,
})

export const put = path => router({
  method: 'put',
  path: path,
})

export const del = path => router({
  method: 'del',
  path: path,
})

export const use = path => router({
  method: 'use',
  path: path,
})

export const all = path => router({
  method: 'all',
  path: path,
})

const decorate = (args, middleware) => {
  let [ target, key, descriptor ] = args

  target[key] = isArray(target[key])
  target[key].unshift(middleware)

  return descriptor
}

const convert = (middleware) => {
  return (...args) => {
    return decorate(args, middleware)
  }
}

export const auth = convert(async (ctx, next) => {
  const user = ctx.session.user

  if (!user) {
    return (
      ctx.body = {
        success: false,
        code: 401,
        error:'登录信息失效，请重新登录!'
      }
    )
  }

  await next()
})

export const role = expectRole => convert(async (ctx, next)=> {
  const user = ctx.session.user

  if (!user && user.role !== expectRole) {
    return (
      ctx.body = {
        success: false,
        code: 403,
        error: '权限不足,请联系管理员。'
      }
    )
  }
})