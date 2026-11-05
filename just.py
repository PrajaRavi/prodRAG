# from langchain_community.document_loaders import PyPDFLoader

# import glob
# for path in glob.glob(f"backend/assets/*.pdf"):
#   reader=PyPDFLoader(path)
#   data=reader.load()
#   print(data)
#   print(len(data))
#   print("="*100)
import time
ctime=time.time()
for i in range(5):
  print(i)
  time.sleep(1)
print("total time: ",time.time()-ctime)