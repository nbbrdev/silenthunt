import { Mesh, Vector3, VertexData, type Scene } from "@babylonjs/core";

/**
 * Builds many textured quads ("cards") into one mesh: each card shows a whole cluster of leaves
 * from the foliage texture. This is how games make full canopies with few triangles.
 */
export class CardBuilder {
  private readonly positions: number[] = [];
  private readonly indices: number[] = [];
  private readonly uvs: number[] = [];
  private readonly normals: number[] = [];

  /**
   * Adds one card. `normal` is the side it faces; `up` sets how the texture is turned (texture
   * top points toward `up`).
   */
  addCard(center: Vector3, width: number, height: number, normal: Vector3, up: Vector3): void {
    const n = normal.normalizeToNew();
    let u = Vector3.Cross(up, n);
    if (u.lengthSquared() < 1e-6) {
      u = Vector3.Cross(Vector3.Right(), n);
    }
    u.normalize();
    const v = Vector3.Cross(n, u).normalize();
    const halfU = u.scale(width / 2);
    const halfV = v.scale(height / 2);

    const base = this.positions.length / 3;
    const corners = [
      center.subtract(halfU).subtract(halfV),
      center.add(halfU).subtract(halfV),
      center.add(halfU).add(halfV),
      center.subtract(halfU).add(halfV),
    ];
    for (const corner of corners) {
      this.positions.push(corner.x, corner.y, corner.z);
      this.normals.push(n.x, n.y, n.z);
    }
    this.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  get cardCount(): number {
    return this.positions.length / 12;
  }

  /**
   * Creates the mesh. With `lightCenter`, every normal points away from that point, so the
   * canopy is lit like one soft volume instead of many flat planes.
   */
  build(name: string, scene: Scene, lightCenter?: Vector3): Mesh {
    if (lightCenter) {
      for (let i = 0; i < this.positions.length; i += 3) {
        const out = new Vector3(
          (this.positions[i] ?? 0) - lightCenter.x,
          (this.positions[i + 1] ?? 0) - lightCenter.y,
          (this.positions[i + 2] ?? 0) - lightCenter.z,
        ).normalize();
        this.normals[i] = out.x;
        this.normals[i + 1] = out.y;
        this.normals[i + 2] = out.z;
      }
    }
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.indices = this.indices;
    data.normals = this.normals;
    data.uvs = this.uvs;
    data.applyToMesh(mesh, true);
    return mesh;
  }
}

/** Random direction on the unit sphere. */
export function randomDirection(random: () => number): Vector3 {
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new Vector3(r * Math.cos(angle), z, r * Math.sin(angle));
}
