// didact global states
let nextUnitOfWork = null
let currentRoot = null // reference to the last fiber tree that was committed to the DOM
let wipRoot = null

// need global variables before calling the function component to 
// use them within the useState function
let wipFiber = null
let hookIndex = null

// helper flags
const isEvent = key => key.startsWith("on")
const isProperty = key => key !== "children"
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children
        }
    }
}

function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: []
        }
    }
}

function createDOM(fiber) {
    const dom =
        fiber.type == "TEXT_ELEMENT"
            ? document.createTextNode("")
            : document.createElement(fiber.type)
    
    const isProperty = key => key !== "children"
    Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] = fiber.props[name]
        })        
    
    return dom
}

// compare props from old fiber to the props of the new fiber
// remove props that are gone, and set props that are new or changed
function updateDom(dom, prevProps, nextProps) {
    // remove old or changed event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(
            key => 
                !(key in nextProps) ||
                isNew(prevProps, nextProps)(key)
        )
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.removeEventListener(
                eventType,
                prevProps[name]
            )
        })

    // remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ""
        })

    // set new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name]
        })

    // add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.addEventListener(
                eventType,
                nextProps[name]
            )
        })
}

// recursively append all nodes to the dom
function commitWork(fiber) {
    if (!fiber) {
        return
    }

    // goes up the fiber tree until we find a fiber with a DOM node
    // to find the parent of the DOM node
    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
        domParent.appendChild(fiber.dom)
    } else if (fiber.effectTag === "DELETION") {
        commitDeletion(fiber, domParent)
    } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
        updateDom(
            fiber.dom,
            fiber.alternate.props,
            fiber.props
        )
    }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
    // need to recurse until we find a child with a DOM node
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}

function commitRoot() {
    // remove nodes from dom
    deletions.forEach(commitWork)

    // add nodes to dom
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

function render(element, container) {
    // set the next unit of work to the root of the fiber tree
    // keep track of the incomplete tree
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        // link to the old fiber that was committed 
        // in the previous commit phase
        alternate: currentRoot, 
    }
    // when we commit the fiber tree to the DOM we do it from the wipRoot,
    // which does not have the old fibers. we need to keep track of the nodes
    // we want to remove
    deletions = []
    nextUnitOfWork = wipRoot
}

function performUnitOfWork(nextUnitOfWork) {
    const isFunctionComponent = 
        fiber.type instanceof Function
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    // return next unit of work
    // first try with child, then sibling, then uncle, etc.
    if (fiber.child) {
        return fiber.child
    }

    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}


function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    // retrieve children by running the function
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

function useState(initial) {
    // check if we have a old hook
    const oldHook = 
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex]

    // if there exists an old hook, copy the state
    // from the old hook to the new hook
    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: [],
    }

    // run the old actions by getting all old actions from 
    // the old hook queue and apply them one by one to the new hook state
    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => [
        hook.state = action(hook.state)
    ])

    const setState = action => {
        hook.queue.push(action)

        // set new WIP root as the next unit of work so that 
        // the work loop can start a new render phase
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    // add the hook to the fiber, and increment
    // the hook index by one and return the state
    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}

function updateHostComponent(fiber) {
    // add dom node
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    // create new fibers
    const elements = fiber.props.children
    reconcileChildren(fiber, elements)
}

// reconciles old fibers with the new elements
function reconcileChildren(wipFiber, elements) {
    let index = 0
    let oldFiber = 
        wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null

    while (index < elements.length || oldFiber != null) {
        const element = elements[index]
        let newFiber = null

        // TODO compare oldFiber to element
        const sameType = 
            oldFiber && 
            element && 
            element.type == oldFiber.type
        
            if (sameType) {
                // update the node
                newFiber = {
                    type: oldFiber.type,
                    props: element.props,
                    dom: oldFiber.dom,
                    parent: wipFiber,
                    alternate: oldFiber,
                    effectTag: "UPDATE"
                }
            }

            if (element && !sameType) {
                // add this node
                newFiber = {
                    type: element.type,
                    props: element.props,
                    dom: null,
                    parent: wipFiber,
                    alternate: null,
                    effectTag: "PLACEMENT"
                }
            }

            if (oldFiber && !sameType) {
                // delete the oldFiber's node
                oldFiber.effectTag = "DELETION"

                // we don't have a new fiber so we add the 
                // effect tag to the old fiber
                deletions.push(oldFiber)
            }
    }
}

// break work into smaller units
// after finishing each unit yield execution to browser 
function workLoop(deadline) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(
            nextUnitOfWork
        )
        shouldYield = deadline.timeRemaining() < 1
    }

    // commit the whole fiber tree to the DOM
    // only when the whole fiber is built
    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    // browser runs the callback if the main thread is idle
    requestIdleCallback(workLoop)
}

// allows commiting of the WIP dom when the main thread of 
// the browser is freed
requestIdleCallback(workLoop)

const Didact = {
    createElement,
    render,
    useState
}

/** @jsx Didact.createElement */
function Counter() {
    const [state, setState] = Didact.useState(1)
    return (
        <h1 onClick={() => setState(c => c + 1)}>
            Count: {state}
        </h1>
    )
}
const element = <Counter />
const container = document.getElementById("root")
Didact.render(element, container)