using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEngine.UI;using UnityEditor;
public static class ExportGrade {
 [Serializable]public class Pack{public string unityVersion;public string colorSpace;public float duration=3.4f;public int fps=60,particleStride=12;public Grade[] grades;}
 [Serializable]public class Grade{public string id,prefab;public float[] imageRect;public string image;public float delay;public Layer[] layers;public Frame[] frames;}
 [Serializable]public class Layer{public string name,shader,texture,sortingLayer;public int order;public float maxSize;public Sheet sheet;public string[] keys;public float[] values,color,core,tint,extent,reach;}
 [Serializable]public class Sheet{public bool enabled;public int columns,rows,cycles;public string timeMode;}
 [Serializable]public class Frame{public float t;public float[] text;public float[] particles;}
 static string[] keys={"_Shape","_CorePoint","_Intensity","_Bands","_BlendAlpha","_AlphaShrinks","_Thickness","_Falloff","_Halo","_HaloSize","_RayCount","_RaySharpness","_PixelSize","_PixelSnap","_Prism","_PrismHue","_PrismSpread","_PrismCore","_EndFade","_CoreWidth","_CoreBoost","_Mode","_SequenceTime","_Seed","_BeamWidth","_GlowStrength","_SparkCount","_Layer","_BeamFadeEnd"};
 static float[] C(Color c)=>new[]{c.r,c.g,c.b,c.a};
 static Camera sheetCamera;static Mesh sheetMesh;
 // Read the frame from Unity's rendered UVs, including its actual lifetime curve,
 // start frame, cycles and row selection. GetParticles alone does not expose UVs.
 public static float[] SpriteFrames(ParticleSystem ps,ParticleSystem.Particle[] particles){
  var frames=Enumerable.Repeat(-1f,particles.Length).ToArray();if(!ps.textureSheetAnimation.enabled||particles.Length==0)return frames;
  if(!sheetCamera){sheetCamera=new GameObject("gradeSheetCamera").AddComponent<Camera>();sheetCamera.enabled=false;sheetCamera.orthographic=true;sheetCamera.orthographicSize=720f/(440f/2.522f)/2;sheetCamera.aspect=1280f/720;sheetCamera.transform.position=new Vector3(0,-1.429f,-10);sheetMesh=new Mesh();}
  var renderer=ps.GetComponent<ParticleSystemRenderer>();sheetMesh.Clear();renderer.BakeMesh(sheetMesh,sheetCamera,true);var vertices=sheetMesh.vertices;var uv=sheetMesh.uv;var used=new bool[particles.Length];
  if(vertices.Length!=particles.Length*4)throw new Exception(ps.name+": expected four vertices per sprite");
  for(int v=0;v<vertices.Length;v+=4){var center=(vertices[v]+vertices[v+1]+vertices[v+2]+vertices[v+3])/4+renderer.transform.position;int best=-1;float distance=float.MaxValue;
   for(int i=0;i<particles.Length;i++){if(used[i])continue;var pos=ps.main.simulationSpace==ParticleSystemSimulationSpace.World?particles[i].position:ps.transform.TransformPoint(particles[i].position);float d=(center-pos).sqrMagnitude;if(d<distance){best=i;distance=d;}}
   if(best<0||distance>.00001f)throw new Exception(ps.name+": could not match baked UV to particle "+distance);used[best]=true;
   float u=uv.Skip(v).Take(4).Min(p=>p.x),y=uv.Skip(v).Take(4).Min(p=>p.y);var sheet=ps.textureSheetAnimation;
   frames[best]=Mathf.RoundToInt(u*sheet.numTilesX)+(sheet.numTilesY-1-Mathf.RoundToInt(y*sheet.numTilesY))*sheet.numTilesX;
  }return frames;
 }
 public static void Run(){try{
 var ids=new[]{"excellent","good","decent","poor","sewage"};var names=new[]{"Excellent_Gold","Good_Green","Decent_Cyan","Poor_Red","Sewage_Purple"};var grades=new List<Grade>();Time.fixedDeltaTime=1f/60;
 for(int k=0;k<ids.Length;k++){
 string path="Assets/01.Game/03.Content/08.Prefabs/05.Vfx/02.GradeColorSet/FX_GradeReveal_"+names[k]+".prefab";
 var go=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(path));go.transform.position=Vector3.zero;
 var root=go.GetComponent<ParticleSystem>();var systems=go.GetComponentsInChildren<ParticleSystem>();
 for(int j=0;j<systems.Length;j++){systems[j].Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);systems[j].useAutoRandomSeed=false;systems[j].randomSeed=(uint)(103+j*97);}
 var seq=go.GetComponent<GradeRevealSequence>();var so=new SerializedObject(seq);var delay=so.FindProperty("revealDelay").floatValue;
 var ac=so.FindProperty("alphaOverTime").animationCurveValue;var xc=so.FindProperty("scaleXOverTime").animationCurveValue;var yc=so.FindProperty("scaleYOverTime").animationCurveValue;
 var image=go.GetComponentsInChildren<Image>().First(i=>i.name=="GradeText_Image");var corners=new Vector3[4];image.rectTransform.GetWorldCorners(corners);
 var layers=new List<Layer>();foreach(var ps in systems){var r=ps.GetComponent<ParticleSystemRenderer>();var m=r.sharedMaterial;layers.Add(new Layer{name=ps.name,shader=m?m.shader.name:"",texture=m&&m.HasProperty("_MainTex")?AssetDatabase.GetAssetPath(m.GetTexture("_MainTex")):"",sortingLayer=r.sortingLayerName,order=r.sortingOrder,maxSize=r.maxParticleSize,sheet=new Sheet{enabled=ps.textureSheetAnimation.enabled,columns=ps.textureSheetAnimation.numTilesX,rows=ps.textureSheetAnimation.numTilesY,cycles=ps.textureSheetAnimation.cycleCount,timeMode=ps.textureSheetAnimation.timeMode.ToString()},keys=keys,values=keys.Select(x=>m&&m.HasProperty(x)?m.GetFloat(x):0).ToArray(),color=m&&m.HasProperty("_Color")?C(m.GetColor("_Color")):new float[]{1,1,1,1},tint=m&&m.HasProperty("_Tint")?C(m.GetColor("_Tint")):new float[]{1,1,1,1},extent=m&&m.HasProperty("_Extent")?C(m.GetVector("_Extent")):new float[]{1,1,0,0},reach=m&&m.HasProperty("_PrismReach")?C(m.GetVector("_PrismReach")):new float[]{1,1,0,0},core=m&&m.HasProperty("_CoreColor")?C(m.GetColor("_CoreColor")):new float[]{1,1,1,1}});}
 var frames=new List<Frame>();for(int f=0;f<=204;f++){float t=f/60f;root.Simulate(t,true,true,true);var particles=new List<float[]>();for(int j=0;j<systems.Length;j++){var ps=systems[j];var list=new ParticleSystem.Particle[ps.particleCount];int n=ps.GetParticles(list);var spriteFrames=SpriteFrames(ps,list);for(int a=0;a<n;a++){var p=list[a];var pos=ps.main.simulationSpace==ParticleSystemSimulationSpace.World?p.position:ps.transform.TransformPoint(p.position);var size=p.GetCurrentSize3D(ps);var ls=ps.transform.lossyScale;size=Vector3.Scale(size,ls);var c=p.GetCurrentColor(ps);particles.Add(new[]{(float)j,pos.x,pos.y,pos.z,size.x,size.y,p.rotation3D.z+ps.transform.eulerAngles.z,c.r/255f,c.g/255f,c.b/255f,c.a/255f,spriteFrames[a]});}}
 frames.Add(new Frame{t=t,text=new[]{xc.Evaluate(Mathf.Max(0,t-delay)),yc.Evaluate(Mathf.Max(0,t-delay)),t<delay?0:Mathf.Clamp01(ac.Evaluate(t-delay))},particles=particles.SelectMany(x=>x).ToArray()});}
 grades.Add(new Grade{id=ids[k],prefab=path,image=AssetDatabase.GetAssetPath(image.sprite.texture),imageRect=new[]{corners[0].x,corners[0].y,corners[2].x-corners[0].x,corners[2].y-corners[0].y},delay=delay,layers=layers.ToArray(),frames=frames.ToArray()});UnityEngine.Object.DestroyImmediate(go);
 }
 File.WriteAllText("/tmp/grade-engine-samples.json",JsonUtility.ToJson(new Pack{unityVersion=Application.unityVersion,colorSpace=PlayerSettings.colorSpace.ToString(),grades=grades.ToArray()}));Debug.Log("GRADE_EXPORT_OK");EditorApplication.Exit(0);
 }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
}
