﻿const LealoneRpcClient = (function() {
const L = {
    sockjsUrl: "/_lealone_sockjs_",
    serviceUrl: "/service",
    services: [],
    serviceNames: [],
    serviceProxyObjects: [],

    getService(serviceName) {
        if(this.serviceProxyObjects[serviceName] != undefined)
            return this.serviceProxyObjects[serviceName];
        var object = {
            serviceName: serviceName
        }
        this.serviceNames.push(serviceName);
        this.services[serviceName] = object;
        this.serviceProxyObjects[serviceName] = this.getProxyObject(object);
        return this.serviceProxyObjects[serviceName];
    },

    getProxyObject(object) {
        let that = this;
        let missingMethod = this.missingMethod;
        const proxyObject = new Proxy(object, {
            get(object, property) {
                if (Reflect.has(object, property)) {
                    return Reflect.get(object, property);
                } else {
                    return (...args) => Reflect.apply(missingMethod, that, [object, property, ...args]);
                }
            }
        });
        return proxyObject;
    },

    missingMethod(object, method, ...args) {
        this.call(object, method, ...args);
    },

    call(object, methodName) {
        var methodArgs = [];
        var serviceName = object.serviceName;
        var length = arguments.length;
        if(typeof arguments[length - 1] == 'function') {
            this.services[serviceName]["callback"] = arguments[length - 1];
            length--;
        }
        if(length > 2) {
            for(var j = 2; j < length; j++) {
                if(arguments[j].onServiceException) {
                    this.services[serviceName]["onServiceException"] = arguments[j].onServiceException;
                    this.services[serviceName]["serviceObject"] = arguments[j];
                    continue;
                }
                methodArgs.push(arguments[j]);
            }
        }
        this.sendRequest(object.serviceName, methodName, methodArgs);
    },

    call4(serviceContext, service, methodName, arguments) {
        if(service.hooks != undefined) { 
            let hook = service.hooks[methodName];
            if(hook != undefined) {
                let beforeHook = hook["before"];
                if(beforeHook != undefined) {
                    let ret = beforeHook.apply(serviceContext, arguments);
                    if(ret === false)
                        return
                }
            }
        }

        var methodArgs = [];
        var serviceName = service.serviceName;
        this.services[serviceName]["onServiceException"] = serviceContext.onServiceException;
        this.services[serviceName]["serviceObject"] = serviceContext;
        this.services[serviceName]["hooks"] = service.hooks;

        var argumentCount = arguments.length;
        if(typeof arguments[argumentCount - 1] == 'function') {
            this.services[serviceName]["callback"] = arguments[argumentCount - 1];
            argumentCount--;
        }
        // 过滤掉事件对象
        if(argumentCount > 0 && arguments[argumentCount - 1].defaultPrevented != undefined) {
            argumentCount--;
        }
        var names = service.methodInfo[methodName];
        var columnCount = names.length;
        var length = columnCount > argumentCount ? argumentCount : columnCount;
        var columnIndex = 0;
        if(serviceContext.gid == lealone.page && methodName == lealone.methodName) {
            length = lealone.params.length;
            for(var i = 0; i < length; i++) { 
                methodArgs.push(lealone.params[i]);
                columnIndex++;
            }
        }
        else if(argumentCount > 0) {
            for(var i = 0; i < length; i++) { 
                methodArgs.push(arguments[i]);
                columnIndex++;
            }
        }
        if(columnIndex < columnCount) { 
            for(var i = columnIndex; i < columnCount; i++) {
                // 存在相应字段时才加
                if(serviceContext[names[i]] != undefined)
                    methodArgs.push(serviceContext[names[i]]);
                else
                    methodArgs.push('');
            }
        }
        this.sendRequest(service.serviceName, methodName, methodArgs);
    },

    callService(serviceContext, serviceName, methodName, methodArgs) {
        var service = this.services[serviceName];
        this.call4(serviceContext, service, methodName, methodArgs);
    },

    loadServices(callback) {
        var systemService = this.getService("system_service");
        systemService.loadServices(this.serviceNames.join(","), services => {
            for(var i = 0; i < services.length; i++) {
                var serviceInfo = services[i];
                var service = this.getService(serviceInfo.serviceName);
                var parameterNames = [];
                service.methodInfo = {};
                var funBody = "return {"
                for(var m = 0; m < serviceInfo.serviceMethods.length; m++) {
                    var serviceMethodInfo = serviceInfo.serviceMethods[m];
                    funBody += serviceMethodInfo.methodName + "(){ Lealone.callService(this, '" 
                             + serviceInfo.serviceName + "', '"+ serviceMethodInfo.methodName + "', arguments)},";
                    
                    service.methodInfo[serviceMethodInfo.methodName] = serviceMethodInfo.parameterNames;
                    for(var p = 0; p < serviceMethodInfo.parameterNames.length; p++) {
                        parameterNames.push(serviceMethodInfo.parameterNames[p]);
                    }
                }
                funBody += " }";
                var fun = new Function(funBody);
                service.parameterNames = parameterNames;
                service.methods = fun();
                for(var m in service.methods) {
                    service[m] = service.methods[m];
                }
                // console.log(parameterNames);
            }
            if(callback != undefined)
                callback(services);
        });
    },

    initSockJS() {
        var that = this;
        var sockjs = new SockJS(this.sockjsUrl); // {"transports":"xhr_streaming"}
        that.sockjs = sockjs;
        sockjs.onopen = function() {
            that.sockjsReady = true; 
            if(that.penddingMsgs) {
                for(var i = 0; i < that.penddingMsgs.length; i++) {
                    sockjs.send(that.penddingMsgs[i]);
                }
                that.penddingMsgs = [];
            }
        };
        sockjs.onmessage = function(e) {
            that.handleResponse(e);
        };
        sockjs.onclose = function() {
            console.log("SockJS close");
        };
    },

    sendRequest(serviceName, methodName, methodArgs) {
        if(window.axios != undefined) {
            var underscoreMethodName = methodName.replace(/([A-Z])/, function(v) { return '_' + v.toLowerCase(); });
            var url = this.serviceUrl + "/" + serviceName + "/" + underscoreMethodName;
            axios.post(url, { methodArgs : JSON.stringify(methodArgs) })
            .then(response => {
                this.handleResponse(response);
            })
            .catch(error => {
                this.handleError(serviceName, error.message);
            });
        } else if(window.SockJS != undefined) {
            if(!this.sockjs) {
                this.initSockJS();
            }
            // 格式: type;serviceName.methodName;[arg1,arg2,...argn]
            var msg = "1;" + serviceName + "." + methodName + ";" + JSON.stringify(methodArgs);
            if(this.sockjsReady)
                this.sockjs.send(msg);
            else {
                if(!this.penddingMsgs) {
                    this.penddingMsgs = [];
                } 
                this.penddingMsgs.push(msg);
            }
        } else {
            handleError(serviceName, "axios or sockjs not found");
        }
    },

    handleResponse(response) {
        var a = [];
        if(Array.isArray(response.data))
            a = response.data;
        else
            a = JSON.parse(response.data);
        var type = a[0];
        var serviceAndMethodName = a[1].split(".");
        var serviceName = serviceAndMethodName[0];
        var methodName = serviceAndMethodName[1];
        var service = this.services[serviceName];
        if(!service) {
            console.log("not found service name: "+ serviceName);
            return;
        }
        var result = a[2];
        switch(type) {
            case 2: // 正常返回
                // 如果有回调就执行它
                if(service["callback"]) {
                    try {
                        result = JSON.parse(result); // 尝试转换成json对象
                    } catch(e) {
                    }
                    service["callback"](result);
                }
                else if(service["serviceObject"]) {
                    try {
                        var serviceObject = service["serviceObject"];
                        var isJson = true;
                        try {
                            result = JSON.parse(result); // 尝试转换成json对象
                        } catch(e) {
                            isJson = false;
                        }

                        let hooks = service["hooks"];
                        if(hooks != undefined) { 
                            let hook = hooks[methodName];
                            if(hook != undefined) {
                                let handleHook = hook["handle"];
                                //手动处理结果
                                if(handleHook != undefined) {
                                    handleHook.call(serviceObject, result);
                                    return;
                                }
                            }
                        }
                        //自动关联字段
                        if(isJson) {
                            var isInitMethod = serviceObject.services != undefined && serviceObject.services[1] === true;
                            for(var key in result) {
                                if(isInitMethod) {
                                    if(serviceObject.$data)
                                        serviceObject.$data[key] = result[key];
                                    else
                                        serviceObject[key] = result[key];
                                }
                                else if(serviceObject[key] != undefined) {
                                    serviceObject[key] = result[key];
                                }
                            }
                        }
                        if(hooks != undefined) { 
                            let hook = hooks[methodName];
                            if(hook != undefined) {
                                let afterHook = hook["after"];
                                if(afterHook != undefined) {
                                    afterHook.call(serviceObject, result);
                                }
                            }
                        } 
                    } catch(e) {
                        console.log(e);
                    } 
                }
                break;
            case 3: // error
                var msg = "failed to call service: " + a[1] + ", backend error: " + result;
                handleError(serviceName, msg);
                break;
            default:
                var msg = "unknown response type: " + type + ", response data: " + response.data;
                handleError(serviceName, msg);
        }
    },

    handleError(serviceName, msg) {
        var service = this.services[serviceName];
        if(!service) {
            console.log(msg);
        } else {
            if(service["onServiceException"]) 
                service["onServiceException"](msg);
            else {
                let hooks = service["hooks"];
                if(hooks != undefined) { 
                    let hook = hooks[methodName];
                    if(hook != undefined) {
                        let errorHook = hook["error"];
                        if(errorHook != undefined) {
                            errorHook.call(service["serviceObject"], msg);
                            return;
                        }
                    }
                } 
                console.log(msg)
            }
        }
    },
};

return {
    setSockjsUrl: function(url) { L.sockjsUrl = url },
    setServiceUrl: function(url) { L.serviceUrl = url },
    getService: function() { return L.getService.apply(L, arguments) }, 
    loadServices: function() { return L.loadServices.apply(L, arguments) }, 
    callService: function() { return L.callService.apply(L, arguments) }, 
};
})();

if(!window.lealone) window.lealone = LealoneRpcClient;
