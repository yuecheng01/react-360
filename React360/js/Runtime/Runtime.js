/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import * as THREE from 'three';
import Location from '../Compositor/Location';
import Surface from '../Compositor/Surface';
import type ReactExecutor from '../Executor/ReactExecutor';
import ReactExecutorWebWorker from '../Executor/ReactExecutorWebWorker';
import {type Quaternion, type Ray, type Vec3} from '../Controls/Types';
import {type InputEvent} from '../Controls/InputChannels/Types';
import type Module from '../Modules/Module';
import type {CustomView} from '../Modules/UIManager';
import GuiSys from '../OVRUI/UIView/GuiSys';
import {ReactNativeContext} from '../ReactNativeContext';

type LocationNode = {
  location: Location,
  node: THREE.Object3D,
};

export type NativeModuleInitializer = ReactNativeContext => Module;

export type RuntimeOptions = {
  assetRoot?: string,
  customViews?: Array<CustomView>,
  executor?: ReactExecutor,
  nativeModules?: Array<Module | NativeModuleInitializer>,
};

const raycaster = new THREE.Raycaster();
function intersectObject(
  object: Object,
  ray: THREE.Raycaster,
  intersects: Array<Object>,
) {
  if (object.visible === false) {
    return;
  }
  object.raycast(ray, intersects);
  const children = object.children;
  for (let i = 0, l = children.length; i < l; i++) {
    intersectObject(children[i], ray, intersects);
  }
}

const DEVTOOLS_FLAG = /\bdevtools\b/;
const SURFACE_DEPTH = 4; // 4 meters

/**
 * Runtime wraps the majority of React VR logic. It sends event data to the
 * Executor, builds an in-memory realization of the React nodes, and tells
 * the Compositor how to render everything.
 */
export default class Runtime {
  _cursorIntersectsSurface: boolean;
  _initialized: boolean;
  _rootLocations: Array<LocationNode>;
  context: ReactNativeContext;
  executor: ReactExecutor;
  guiSys: GuiSys;

  constructor(
    scene: THREE.Scene,
    bundle: string,
    options: RuntimeOptions = {},
  ) {
    this._rootLocations = [];
    this._cursorIntersectsSurface = false;
    let enableDevTools = false;
    if (__DEV__) {
      if (DEVTOOLS_FLAG.test(location.search)) {
        enableDevTools = true;
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          /* eslint-disable no-console */
          console.log(
            'We detected that you have the React Devtools extension installed. ' +
              'Please note that at this time, React VR is only compatible with the ' +
              'standalone Inspector (npm run devtools).',
          );
          /* eslint-enable no-console */
        }
      }
    }
    this.executor =
      options.executor ||
      new ReactExecutorWebWorker({
        enableDevTools,
      });
    const font = options.font
    const guiOptions =  {
      font: font || {},
    }
    this.guiSys = new GuiSys(scene, guiOptions);
    this.context = new ReactNativeContext(this.guiSys, this.executor, {
      assetRoot: options.assetRoot,
      customViews: options.customViews || [],
    });
    const modules = options.nativeModules;
    if (modules) {
      for (let i = 0; i < modules.length; i++) {
        const m = modules[i];
        if (typeof m === 'function') {
          // module initializer
          this.context.registerModule(m(this.context));
        } else {
          this.context.registerModule(m);
        }
      }
    }
    this.context.init(bundle);
  }

  createRootView(name: string, initialProps: Object, dest: Location | Surface) {
    if (dest instanceof Surface) {
      this.guiSys.registerOffscreenRender(
        dest.getScene(),
        dest.getCamera(),
        dest.getRenderTarget(),
      );
      const tag = this.context.createRootView(
        name,
        initialProps,
        dest.getScene(),
        true,
      );
      return tag;
    } else if (dest instanceof Location) {
      const node = new THREE.Object3D();
      node.position.fromArray(dest.worldPosition);
      node.quaternion.fromArray(dest.worldRotation);
      this.guiSys.root.add(node);
      this._rootLocations.push({
        location: dest,
        node: node,
      });
      const tag = this.context.createRootView(name, initialProps, (node: any));
      return tag;
    }
    throw new Error('Invalid mount point');
  }

  frame(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.guiSys.frameRenderUpdates(camera);
    this.context.frame(camera);

    const offscreen = this.guiSys.getOffscreenRenders();
    for (const item in offscreen) {
      if (!offscreen.hasOwnProperty(item)) {
        continue;
      }
      const params = offscreen[item];
      const oldClearColor = renderer.getClearColor();
      const oldClearAlpha = renderer.getClearAlpha();
      const oldSort = renderer.sortObjects;
      const oldClipping = renderer.localClippingEnabled;
      renderer.localClippingEnabled = true;
      renderer.setClearColor('#000', 0);
      renderer.sortObjects = false;
      renderer.render(params.scene, params.camera, params.renderTarget, true);
      renderer.sortObjects = oldSort;
      renderer.setClearColor(oldClearColor, oldClearAlpha);
      renderer.setRenderTarget(null);
      renderer.localClippingEnabled = oldClipping;
    }
    for (let i = 0; i < this._rootLocations.length; i++) {
      const {location, node} = this._rootLocations[i];
      if (location.isDirty()) {
        const worldPosition = location.worldPosition;
        node.position.set(worldPosition[0], worldPosition[1], worldPosition[2]);
        const worldRotation = location.worldRotation;
        node.quaternion.set(
          worldRotation[0],
          worldRotation[1],
          worldRotation[2],
          worldRotation[3],
        );
        location.clearDirtyFlag();
      }
    }
  }

  queueEvents(events: Array<InputEvent>) {
    for (let i = 0; i < events.length; i++) {
      this.guiSys.eventDispatcher.dispatchEvent({
        type: 'InputChannelEvent',
        args: events[i],
      });
    }
  }

  setRays(rays: Array<Ray>, cameraPosition: Vec3, cameraQuat: Quaternion) {
    if (rays.length < 1) {
      this.guiSys.updateLastHit(null, '');
      return;
    }
    // TODO: Support multiple raycasters
    const ray = rays[0];

    // This will get replaced with the trig-based raycaster for surfaces
    let firstHit = null;
    raycaster.ray.origin.fromArray(ray.origin);
    raycaster.ray.direction.fromArray(ray.direction);
    const hits = raycaster.intersectObject(this.guiSys.root, true);
    let hitSurface = false;
    for (let i = 0; i < hits.length; i++) {
      let hit = hits[i];
      if (hit.uv && hit.object && hit.object.subScene) {
        hitSurface = true;
        const distanceToSubscene = hit.distance;
        const scene = hit.object.subScene;
        raycaster.ray.origin.set(
          scene._rttWidth * hit.uv.x,
          scene._rttHeight * (1 - hit.uv.y),
          0.1,
        );
        raycaster.ray.direction.set(0, 0, -1);
        const subHits = [];
        intersectObject(scene, raycaster, subHits);
        if (subHits.length === 0) {
          continue;
        }
        hit = subHits[subHits.length - 1];
        hit.distance = distanceToSubscene;
      }
      if (!firstHit && !hit.isAlmostHit) {
        firstHit = hit;
      }
    }
    this._cursorIntersectsSurface = hitSurface;
    if (firstHit) {
      this.guiSys.updateLastHit(firstHit.object, ray.type);
      this.guiSys._cursor.intersectDistance = firstHit.distance;
    } else {
      this.guiSys.updateLastHit(null, ray.type);
    }
    this.guiSys.setCursorProperties(
      ray.origin.slice(),
      ray.direction.slice(),
      ray.drawsCursor,
    );
  }

  isMouseCursorActive(): boolean {
    return this.guiSys.mouseCursorActive;
  }

  isCursorActive(): boolean {
    if (this._cursorIntersectsSurface) {
      return true;
    }

    const lastHit = this.guiSys._cursor.lastHit;
    const lastAlmostHit = this.guiSys._cursor.lastAlmostHit;
    let active = lastHit && lastHit.isInteractable;
    if (!active) {
      active = lastAlmostHit && lastAlmostHit.isInteractable;
    }
    return !!active;
  }

  getCursorDepth(): number {
    // Will derive from React components
    if (this._cursorIntersectsSurface) {
      return SURFACE_DEPTH;
    }
    return this.guiSys._cursor.intersectDistance;
  }
}
