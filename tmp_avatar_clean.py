from PIL import Image

path = r"E:\Программирование\!!!GAMES\Racing\assets\image\avatars\05_Player.webp"
im = Image.open(path).convert("RGBA")
pix = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = pix[x, y]
        if a == 0:
            pix[x, y] = (0, 0, 0, 0)
im.save(path, "WEBP", lossless=True, method=6)
print(path)
