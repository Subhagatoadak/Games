# Custom piece models (.fbx, .glb, .gltf)

## Model Studio
Click **🎬 Studio** to see every model you've added, previewed in 3D. For each model the Studio shows
what it can do (its animations, bones, wings, jaw, tail, and whether it looks like a dragon), and lets you:

- choose which animation plays for each battle action (idle, walk/fly, attack, fire breath, block, hurt,
  death, victory) and preview it with ▶
- turn on **fire breath** (test it with 🔥), **wing flapping** (works even without a flap animation, as long
  as the model has wing bones/parts named "wing…"; tune speed, strength and axis) and **hovering / flying**
- assign the model to chess pieces

## Easiest: the in-game window
Click **⚙ Piece models…** in the game, then **📁 Choose model folder** and pick the folder with your
`.fbx` / `.glb` / `.gltf` files and their textures (`.jpg`, `.png`, `.tga`). For each piece choose:

- **Model file**, and **Part of file** if one file contains the whole chess set (e.g. pick "King")
- **Facing** (which way it looks), **Upright** (use "Stand up" if a Blender export lies flat), **Size**
- **Fire**: breathes fire instead of using a sword (on automatically when the file name contains "dragon")

"Keep the models' own colours and textures" keeps your textures (Black is shaded darker);
off = white marble / black obsidian. Everything is saved in your browser. Blender `.blend` files
can't be read by a browser — export **FBX** or **GLB** from Blender (File → Export).

## Alternative: this folder (Docker)
Copy the files here and list them in `manifest.json`:

```json
{
  "pieces": {
    "k": "king.fbx",
    "n": { "file": "dragon.glb", "fire": true, "yaw": 90, "tilt": -90, "height": 1.2, "hover": true,
           "flap": { "on": true, "axis": "x", "speed": 6, "amp": 0.6 },
           "clipMap": { "attack": "Bite", "fire": "Breath", "walk": "Fly", "death": "Die" } },
    "p": { "file": "chess_set.fbx", "part": "Pawn" }
  },
  "yaw": 90,
  "keepMaterials": false
}
```
Docker mounts this folder, so just refresh the page.

## Animations
If a model contains animations, they're used automatically, matched by clip name:
idle · walk/run/fly · attack/slash/bite · fire/breath · block/defend · hurt/hit · death/die · victory/roar.
Use `clipMap` to pick clips by exact name when the automatic match is wrong. Models without
animations move as rigid statues (lean, lunge, hop). Fire-breathers attack from a distance.

Only use models you have the rights to use.
