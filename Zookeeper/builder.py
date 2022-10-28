import sys

if __name__ == '__main__':
    sys.stdout = open("./component.log", "w")
    sys.stdout.write("hello world")
