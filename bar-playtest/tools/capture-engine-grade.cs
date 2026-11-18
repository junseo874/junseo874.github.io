using System;using System.IO;using System.Linq;using UnityEngine;using UnityEngine.Rendering;using UnityEngine.UI;using UnityEditor;
public static class CaptureGrade {
 public static void Run(){try{
 Time.fixedDeltaTime=1f/60;Directory.CreateDirectory("/tmp/grade-unity-full");
 float ppu=440f/2.522f,oy=40f+.405f*ppu;int w=1280,h=720;
 var cam=new GameObject("captureCamera").AddComponent<Camera>();cam.orthographic=true;cam.orthographicSize=h/ppu/2;cam.aspect=(float)w/h;cam.transform.position=new Vector3(0,(oy-h/2)/ppu,-10);cam.nearClipPlane=.1f;cam.farClipPlane=100;
 var rt=new RenderTexture(w,h,24,RenderTextureFormat.ARGBFloat,RenderTextureReadWrite.Linear);rt.Create();cam.targetTexture=rt;
 string[] ids={"excellent","good","decent","poor","sewage"},names={"Excellent_Gold","Good_Green","Decent_Cyan","Poor_Red","Sewage_Purple"};
 foreach(int k in Enumerable.Range(0,5)){
 var go=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/01.Game/03.Content/08.Prefabs/05.Vfx/02.GradeColorSet/FX_GradeReveal_"+names[k]+".prefab"));var root=go.GetComponent<ParticleSystem>();var systems=go.GetComponentsInChildren<ParticleSystem>();
 for(int j=0;j<systems.Length;j++){systems[j].Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);systems[j].useAutoRandomSeed=false;systems[j].randomSeed=(uint)(103+j*97);}
 foreach(int f in Enumerable.Range(0,841)){
 float t=f/60f;root.Simulate(t,true,true,true);go.GetComponent<GradeWaveSequence>()?.EvaluatePreview(t,true);if(!new[]{3,9,15,18,25,42,90,174,204,240,360,810}.Contains(f))continue;
 foreach(bool spriteOnly in new[]{false,true}){
 var cmd=new CommandBuffer();cmd.SetRenderTarget(rt);cmd.ClearRenderTarget(true,true,Color.black);cmd.SetViewProjectionMatrices(cam.worldToCameraMatrix,cam.projectionMatrix);
 bool lettering=false;Action drawText=()=>{var image=go.GetComponentsInChildren<Image>().First(i=>i.name=="GradeText_Image");var sequence=new SerializedObject(go.GetComponent<GradeRevealSequence>());float elapsed=t-sequence.FindProperty("revealDelay").floatValue;
 float alpha=elapsed<0?0:sequence.FindProperty("alphaOverTime").animationCurveValue.Evaluate(elapsed),sx=sequence.FindProperty("scaleXOverTime").animationCurveValue.Evaluate(Mathf.Max(0,elapsed)),sy=sequence.FindProperty("scaleYOverTime").animationCurveValue.Evaluate(Mathf.Max(0,elapsed));
 var v=new Vector3[4];image.rectTransform.GetWorldCorners(v);for(int i=0;i<4;i++)v[i]=new Vector3(v[i].x*sx,v[i].y*sy,0);var m=new Mesh();m.vertices=v;m.uv=new[]{new Vector2(0,0),new Vector2(0,1),new Vector2(1,1),new Vector2(1,0)};m.colors=Enumerable.Repeat(new Color(1,1,1,alpha),4).ToArray();m.triangles=new[]{0,1,2,0,2,3};var material=new Material(image.material);material.SetTexture("_MainTex",image.sprite.texture);cmd.DrawMesh(m,Matrix4x4.identity,material,0,0);};
 foreach(var ps in systems.OrderBy(p=>p.GetComponent<ParticleSystemRenderer>().sortingOrder)){
 if(spriteOnly&&!ps.textureSheetAnimation.enabled)continue;
 var r=ps.GetComponent<ParticleSystemRenderer>();if(!spriteOnly&&!lettering&&r.sortingOrder>=20){drawText();lettering=true;}if(!r.sharedMaterial||ps.particleCount==0)continue;var mesh=new Mesh();r.BakeMesh(mesh,cam,true);var block=new MaterialPropertyBlock();r.GetPropertyBlock(block);block.SetFloat("_SequenceTime",t);cmd.DrawMesh(mesh,Matrix4x4.Translate(r.transform.position),r.sharedMaterial,0,0,block);

 }
 if(!spriteOnly&&!lettering)drawText();Graphics.ExecuteCommandBuffer(cmd);cmd.Release();RenderTexture.active=rt;var lin=new Texture2D(w,h,TextureFormat.RGBAFloat,false,true);lin.ReadPixels(new Rect(0,0,w,h),0,0);lin.Apply();var pixels=lin.GetPixels();for(int i=0;i<pixels.Length;i++){pixels[i]=pixels[i].gamma;pixels[i].a=1;}var png=new Texture2D(w,h,TextureFormat.RGBA32,false);png.SetPixels(pixels);png.Apply();File.WriteAllBytes("/tmp/grade-unity-full/"+ids[k]+"-"+f+(spriteOnly?"-sprites":"")+".png",png.EncodeToPNG());UnityEngine.Object.DestroyImmediate(lin);UnityEngine.Object.DestroyImmediate(png);
 }
 }
 UnityEngine.Object.DestroyImmediate(go);
 }
 Debug.Log("GRADE_CAPTURE_OK");EditorApplication.Exit(0);
 }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
}
