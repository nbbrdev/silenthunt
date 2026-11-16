import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  PhysicsShapeType,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
  type Engine,
  type HavokPlugin,
} from "@babylonjs/core";
import { CONFIG } from "../config";

/**
 * Minimal scene that proves the stack works (NBB-124 I8-A): ground, light, fog and a box falling
 * with Havok. The camera belongs to the player (NBB-127). Temporary: replaced by the real world.
 */
export function createDemoScene(engine: Engine, physics: HavokPlugin): Scene {
  const scene = new Scene(engine);
  const { demo } = CONFIG;

  const fogColor = new Color3(demo.fogColor.r, demo.fogColor.g, demo.fogColor.b);
  scene.clearColor = Color4.FromColor3(fogColor);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = fogColor;
  scene.fogDensity = demo.fogDensity;

  scene.enablePhysics(new Vector3(0, CONFIG.physics.gravity, 0), physics);

  new HemisphericLight("ambient", new Vector3(0, 1, 0), scene).intensity = 0.4;
  new DirectionalLight("sun", new Vector3(-0.5, -1, -0.3), scene).intensity = 0.8;

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: demo.groundSize, height: demo.groundSize },
    scene,
  );
  const groundMaterial = new StandardMaterial("groundMaterial", scene);
  groundMaterial.diffuseColor = new Color3(0.2, 0.25, 0.18);
  ground.material = groundMaterial;
  // The visible ground is a flat plane; its collider is a 1 m thick slab just below it, so fast
  // objects in a long physics step (up to 0.1 s in Babylon) cannot pass through it.
  const groundBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, false, scene);
  groundBody.shape = new PhysicsShapeBox(
    new Vector3(0, -0.5, 0),
    Quaternion.Identity(),
    new Vector3(demo.groundSize, 1, demo.groundSize),
    scene,
  );

  const box = MeshBuilder.CreateBox("box", { size: demo.boxSize }, scene);
  box.position.y = demo.boxDropHeight;
  box.rotation = new Vector3(0.4, 0.3, 0.2);
  const boxMaterial = new StandardMaterial("boxMaterial", scene);
  boxMaterial.diffuseColor = new Color3(0.45, 0.3, 0.2);
  box.material = boxMaterial;
  new PhysicsAggregate(
    box,
    PhysicsShapeType.BOX,
    { mass: 1, restitution: demo.boxRestitution },
    scene,
  );

  return scene;
}
